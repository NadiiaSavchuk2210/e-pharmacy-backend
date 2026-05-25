export type ShippingInfoResponse = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export type OrderItemResponse = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
};

export type SerializableOrder<
  TPaymentMethod extends string = string,
  TStatus extends string = string,
> = {
  _id: unknown;
  items: OrderItemResponse[];
  shippingInfo: ShippingInfoResponse;
  paymentMethod: TPaymentMethod;
  subtotal: number;
  deliveryFee: number;
  additionalFee: number;
  total: number;
  status: TStatus;
  createdAt?: Date;
};

export type SerializedOrder<
  TPaymentMethod extends string = string,
  TStatus extends string = string,
> = {
  id: string;
  items: OrderItemResponse[];
  shippingInfo: ShippingInfoResponse;
  paymentMethod: TPaymentMethod;
  subtotal: number;
  deliveryFee: number;
  additionalFee: number;
  total: number;
  status: TStatus;
  createdAt: string;
};
