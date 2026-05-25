import type { SerializedOrder } from '../../common/types/order-response.types';
import type {
  Order,
  OrderStatus,
  PaymentMethod,
} from '../../cart/schemas/order.schema';

export type OrderRecord = Order & {
  _id: unknown;
  createdAt?: Date;
};

export type OrderResponse = SerializedOrder<PaymentMethod, OrderStatus>;

export type OrdersResponse = {
  orders: OrderResponse[];
};

export type UpdateOrderStatusInput = {
  status: OrderStatus;
};

export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
