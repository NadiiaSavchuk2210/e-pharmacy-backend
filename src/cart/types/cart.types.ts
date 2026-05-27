import type { Types } from 'mongoose';
import type {
  SerializedOrder,
  ShippingInfoResponse,
} from '../../common/types/order-response.types';
import type { Product } from '../../products/schemas/product.schema';
import type { PaymentMethod } from '../schemas/order.schema';

export type ProductRecord = Product & {
  _id: Types.ObjectId | string;
};

export type CartItemRecord = {
  productId: string;
  quantity: number;
};

export type CartProductResponse = {
  id: string;
  _id: string;
  photo: string;
  name: string;
  suppliers: string;
  stock: string;
  price: string;
  category: string;
  discount: string | number;
};

export type CartResponse = {
  items: Array<{
    product: CartProductResponse;
    quantity: number;
  }>;
  totalItems: number;
  totalPrice: number;
};

export type UpdateCartInput = {
  productId: string;
  quantity: number;
};

export type CheckoutCartInput = {
  shippingInfo: ShippingInfoResponse;
  paymentMethod: PaymentMethod;
  comment?: string;
};

export type CheckoutResponse = {
  order: SerializedOrder<PaymentMethod>;
};

export type DeliveryQuoteResponse = {
  subtotal: number;
  deliveryFee: number;
  additionalFee: number;
  freeDeliveryThreshold: number;
  amountToFreeDelivery: number;
  message: string;
};
