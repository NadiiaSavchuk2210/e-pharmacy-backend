import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CustomerReviewDocument = HydratedDocument<CustomerReview>;

@Schema({
  collection: 'reviews',
  timestamps: true,
  versionKey: false,
})
export class CustomerReview {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  testimonial: string;
}

export const CustomerReviewSchema =
  SchemaFactory.createForClass(CustomerReview);

CustomerReviewSchema.index({ createdAt: -1 });
