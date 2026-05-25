import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentMethod = 'cash_on_delivery' | 'bank';
export type OrderStatus = 'pending' | 'paid' | 'completed' | 'cancelled';
export type OrderDocument = HydratedDocument<Order>;

@Schema({ _id: false })
export class OrderItem {
  @Prop({ required: true, trim: true })
  productId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  total: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false })
export class ShippingInfo {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, trim: true })
  address: string;
}

export const ShippingInfoSchema = SchemaFactory.createForClass(ShippingInfo);

@Schema({
  collection: 'orders',
  timestamps: true,
  versionKey: false,
})
export class Order {
  _id: unknown;

  createdAt?: Date;

  @Prop({ required: true, index: true, trim: true })
  userId: string;

  @Prop({ type: [OrderItemSchema], required: true, default: [] })
  items: OrderItem[];

  @Prop({ required: true, min: 0 })
  subtotal: number;

  @Prop({ required: true, min: 0 })
  deliveryFee: number;

  @Prop({ required: true, min: 0 })
  additionalFee: number;

  @Prop({ required: true, min: 0 })
  total: number;

  @Prop({ type: ShippingInfoSchema, required: true })
  shippingInfo: ShippingInfo;

  @Prop({
    required: true,
    type: String,
    enum: ['cash_on_delivery', 'bank'],
  })
  paymentMethod: PaymentMethod;

  @Prop({ default: '', trim: true })
  comment: string;

  @Prop({
    default: 'pending',
    type: String,
    enum: ['pending', 'paid', 'completed', 'cancelled'],
  })
  status: OrderStatus;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ userId: 1, createdAt: -1 });
