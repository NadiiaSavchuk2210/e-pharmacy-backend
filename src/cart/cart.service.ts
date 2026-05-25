import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import {
  serializeOrder,
  serializeShippingInfo,
} from '../common/utils/order-response.util';
import {
  Product,
  type ProductDocument,
} from '../products/schemas/product.schema';
import {
  assertEnoughStock,
  buildAtomicStockDecrementFilter,
  buildAtomicStockDecrementUpdate,
  buildManyProductsLookup,
  buildSingleProductLookup,
  calculateDeliveryFees,
  getCanonicalProductId,
  parsePrice,
  parseStock,
  roundMoney,
  serializeProduct,
  toCartItemRecords,
  updateCartItems,
} from './cart.helpers';
import { Cart, type CartDocument } from './schemas/cart.schema';
import {
  Order,
  type OrderDocument,
  type OrderItem,
} from './schemas/order.schema';
import type {
  CartItemRecord,
  CartResponse,
  CheckoutCartInput,
  CheckoutResponse,
  DeliveryQuoteResponse,
  ProductRecord,
  UpdateCartInput,
} from './types/cart.types';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async getCart(userId: string): Promise<CartResponse> {
    const cart = await this.cartModel.findOne({ userId }).lean<{
      items?: CartItemRecord[];
    }>();

    return this.buildCartResponse(cart?.items ?? []);
  }

  async updateCart(
    userId: string,
    updateCartDto: UpdateCartInput,
  ): Promise<CartResponse> {
    const product = await this.findProductById(updateCartDto.productId);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (updateCartDto.quantity > 0) {
      assertEnoughStock(product, updateCartDto.quantity);
    }

    const cart = await this.getOrCreateCart(userId);
    const canonicalProductId = getCanonicalProductId(product);
    const nextItems = updateCartItems(
      toCartItemRecords(cart.items),
      product,
      updateCartDto.productId,
      canonicalProductId,
      updateCartDto.quantity,
    );

    cart.set('items', nextItems);
    await cart.save();

    return this.buildCartResponse(nextItems);
  }

  async checkout(
    userId: string,
    checkoutCartDto: CheckoutCartInput,
  ): Promise<CheckoutResponse> {
    let createdOrder: OrderDocument | null = null;

    await this.connection.transaction(async (session) => {
      const cart = await this.cartModel.findOne({ userId }).session(session);
      const cartItems = toCartItemRecords(cart?.items ?? []);

      if (!cart || cartItems.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      const productsById = await this.getProductsByCartItemId(
        cartItems,
        session,
      );
      const orderItems = cartItems.map((item) => {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new NotFoundException('Product not found');
        }

        assertEnoughStock(product, item.quantity);

        const price = parsePrice(product.price);

        return {
          product,
          orderItem: {
            productId: getCanonicalProductId(product),
            name: product.name,
            price,
            quantity: item.quantity,
            total: roundMoney(price * item.quantity),
          },
        };
      });
      const subtotal = roundMoney(
        orderItems.reduce((total, item) => total + item.orderItem.total, 0),
      );
      const shippingInfo = serializeShippingInfo(checkoutCartDto.shippingInfo);
      const { deliveryFee, additionalFee } = calculateDeliveryFees(
        shippingInfo.address,
        subtotal,
      );
      const total = roundMoney(subtotal + deliveryFee + additionalFee);
      const [order] = await this.orderModel.create(
        [
          {
            userId,
            items: orderItems.map((item) => item.orderItem),
            shippingInfo,
            paymentMethod: checkoutCartDto.paymentMethod,
            subtotal,
            deliveryFee,
            additionalFee,
            total,
            comment: checkoutCartDto.comment ?? '',
            status: 'pending',
          },
        ],
        { session },
      );

      await this.decreaseProductStock(orderItems, session);
      cart.set('items', []);
      await cart.save({ session });
      createdOrder = order;
    });

    if (!createdOrder) {
      throw new BadRequestException('Unable to create order');
    }

    return {
      order: serializeOrder(createdOrder),
    };
  }

  getDeliveryQuote(address: string, subtotal = 0): DeliveryQuoteResponse {
    const { deliveryFee, additionalFee } = calculateDeliveryFees(
      address,
      subtotal,
    );

    return {
      deliveryFee,
      additionalFee,
      message:
        'Delivery and extra fees are calculated based on shipping address',
    };
  }

  private async getOrCreateCart(userId: string): Promise<CartDocument> {
    const existingCart = await this.cartModel.findOne({ userId });

    if (existingCart) {
      return existingCart;
    }

    return this.cartModel.create({
      userId,
      items: [],
    });
  }

  private async findProductById(
    productId: string,
  ): Promise<ProductRecord | null> {
    return this.productModel
      .findOne(buildSingleProductLookup(productId))
      .lean<ProductRecord>();
  }

  private async buildCartResponse(
    items: CartItemRecord[],
  ): Promise<CartResponse> {
    if (items.length === 0) {
      return {
        items: [],
        totalItems: 0,
        totalPrice: 0,
      };
    }

    const productsById = await this.getProductsByCartItemId(items);
    const responseItems = items.reduce<CartResponse['items']>(
      (result, item) => {
        const product = productsById.get(item.productId);

        if (!product) {
          return result;
        }

        result.push({
          product: serializeProduct(product),
          quantity: item.quantity,
        });

        return result;
      },
      [],
    );
    const totalItems = responseItems.reduce(
      (total, item) => total + item.quantity,
      0,
    );
    const totalPrice = roundMoney(
      responseItems.reduce(
        (total, item) => total + parsePrice(item.product.price) * item.quantity,
        0,
      ),
    );

    return {
      items: responseItems,
      totalItems,
      totalPrice,
    };
  }

  private async getProductsByCartItemId(
    items: CartItemRecord[],
    session?: ClientSession,
  ): Promise<Map<string, ProductRecord>> {
    const itemProductIds = items.map((item) => item.productId);
    const query = this.productModel.find(
      buildManyProductsLookup(itemProductIds),
    );

    if (session) {
      query.session(session);
    }

    const products = await query.lean<ProductRecord[]>();
    const productsById = new Map<string, ProductRecord>();

    for (const product of products) {
      productsById.set(getCanonicalProductId(product), product);
      productsById.set(String(product._id), product);

      if (product.id) {
        productsById.set(product.id, product);
      }
    }

    return productsById;
  }

  private async decreaseProductStock(
    orderItems: Array<{
      product: ProductRecord;
      orderItem: OrderItem;
    }>,
    session: ClientSession,
  ): Promise<void> {
    const updateResults = await Promise.all(
      orderItems.map(({ product, orderItem }) => {
        if (parseStock(product.stock) === null) {
          return Promise.resolve({ modifiedCount: 1 });
        }

        return this.productModel.updateOne(
          buildAtomicStockDecrementFilter(product._id, orderItem.quantity),
          buildAtomicStockDecrementUpdate(orderItem.quantity),
          { session },
        );
      }),
    );

    if (updateResults.some((result) => result.modifiedCount !== 1)) {
      throw new BadRequestException('Not enough stock');
    }
  }
}
