import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { CartItem } from './schemas/cart.schema';
import type {
  CartItemRecord,
  CartProductResponse,
  ProductRecord,
} from './types/cart.types';

const BASE_DELIVERY_FEE = 50;
const FREE_DELIVERY_SUBTOTAL = 500;

export function updateCartItems(
  currentItems: CartItemRecord[],
  product: ProductRecord,
  requestedProductId: string,
  canonicalProductId: string,
  quantity: number,
): CartItemRecord[] {
  const matchingProductIds = new Set([
    requestedProductId,
    canonicalProductId,
    String(product._id),
    product.id,
  ]);
  const nextItems = currentItems.filter(
    (item) => !matchingProductIds.has(item.productId),
  );

  if (quantity === 0) {
    return nextItems;
  }

  return [
    ...nextItems,
    {
      productId: canonicalProductId,
      quantity,
    },
  ];
}

export function buildSingleProductLookup(productId: string) {
  const conditions: Record<string, unknown>[] = [{ id: productId }];

  if (Types.ObjectId.isValid(productId)) {
    conditions.push({ _id: new Types.ObjectId(productId) });
  }

  return { $or: conditions };
}

export function buildManyProductsLookup(productIds: string[]) {
  const uniqueProductIds = [...new Set(productIds)];
  const objectIds = uniqueProductIds
    .filter((productId) => Types.ObjectId.isValid(productId))
    .map((productId) => new Types.ObjectId(productId));
  const conditions: Record<string, unknown>[] = [
    { id: { $in: uniqueProductIds } },
  ];

  if (objectIds.length > 0) {
    conditions.push({ _id: { $in: objectIds } });
  }

  return { $or: conditions };
}

export function serializeProduct(product: ProductRecord): CartProductResponse {
  return {
    id: product.id || String(product._id),
    _id: String(product._id),
    photo: product.photo,
    name: product.name,
    suppliers: product.suppliers,
    stock: String(product.stock),
    price: String(product.price),
    category: product.category,
    discount: product.discount ?? 0,
  };
}

export function assertEnoughStock(
  product: ProductRecord,
  quantity: number,
): void {
  const stock = parseStock(product.stock);

  if (stock !== null && quantity > stock) {
    throw new BadRequestException('Not enough stock');
  }
}

export function parseStock(stock: number | string): number | null {
  if (typeof stock === 'number') {
    return Number.isFinite(stock) ? stock : null;
  }

  const normalizedStock = stock.trim().toLowerCase();

  if (
    normalizedStock.includes('out of stock') ||
    normalizedStock.includes('unavailable')
  ) {
    return 0;
  }

  const stockValue = Number.parseInt(normalizedStock.replace(/\D/g, ''), 10);

  return Number.isNaN(stockValue) ? null : stockValue;
}

export function parsePrice(price: number | string): number {
  if (typeof price === 'number') {
    return Number.isFinite(price) ? roundMoney(price) : 0;
  }

  const normalizedPrice = price.replace(',', '.').replace(/[^\d.]/g, '');
  const parsedPrice = Number.parseFloat(normalizedPrice);

  return Number.isNaN(parsedPrice) ? 0 : roundMoney(parsedPrice);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateDeliveryFees(
  address: string,
  subtotal = 0,
): {
  deliveryFee: number;
  additionalFee: number;
} {
  const hasShippingAddress = address.trim().length > 0;
  const hasFreeDelivery = subtotal >= FREE_DELIVERY_SUBTOTAL;

  return {
    deliveryFee: hasShippingAddress && !hasFreeDelivery ? BASE_DELIVERY_FEE : 0,
    additionalFee: 0,
  };
}

export function buildAtomicStockDecrementFilter(
  productId: ProductRecord['_id'],
  quantity: number,
): Record<string, unknown> {
  return {
    _id: productId,
    $expr: {
      $gte: [buildNumericStockExpression(-1), quantity],
    },
  };
}

export function buildAtomicStockDecrementUpdate(
  quantity: number,
): Array<Record<string, unknown>> {
  return [
    {
      $set: {
        stock: {
          $toString: {
            $subtract: [buildNumericStockExpression(0), quantity],
          },
        },
      },
    },
  ];
}

export function getCanonicalProductId(product: ProductRecord): string {
  return product.id || String(product._id);
}

export function toCartItemRecords(items: CartItem[]): CartItemRecord[] {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
  }));
}

function buildNumericStockExpression(onInvalidValue: number) {
  return {
    $convert: {
      input: '$stock',
      to: 'int',
      onError: onInvalidValue,
      onNull: onInvalidValue,
    },
  };
}
