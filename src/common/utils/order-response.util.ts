import type {
  SerializableOrder,
  SerializedOrder,
  ShippingInfoResponse,
} from '../types/order-response.types';

export function serializeShippingInfo(
  shippingInfo: ShippingInfoResponse,
): ShippingInfoResponse {
  return {
    name: shippingInfo.name,
    email: shippingInfo.email,
    phone: shippingInfo.phone,
    address: shippingInfo.address,
  };
}

export function serializeOrder<
  TPaymentMethod extends string,
  TStatus extends string,
>(
  order: SerializableOrder<TPaymentMethod, TStatus>,
): SerializedOrder<TPaymentMethod, TStatus> {
  return {
    id: String(order._id),
    items: order.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      total: item.total,
    })),
    shippingInfo: serializeShippingInfo(order.shippingInfo),
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    additionalFee: order.additionalFee,
    total: order.total,
    status: order.status,
    createdAt: (order.createdAt ?? new Date()).toISOString(),
  };
}
