import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Product } from '../../products/schemas/product.schema';
import { User } from '../../user/schemas/user.schema';

export const PRODUCT_REVIEW_STATUSES = ['published', 'pending'] as const;

export type ProductReviewStatus = (typeof PRODUCT_REVIEW_STATUSES)[number];
export type ProductReviewDocument = HydratedDocument<ProductReview>;

@Schema({
  collection: 'product_reviews',
  timestamps: true,
  versionKey: false,
})
export class ProductReview {
  @Prop({
    required: true,
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
  })
  productId: Types.ObjectId;

  @Prop({
    required: false,
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
  })
  userId?: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 120 })
  authorName: string;

  @Prop({ required: true, trim: true, maxlength: 2048 })
  authorAvatar: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 4000 })
  comment: string;

  @Prop({
    required: false,
    type: String,
    enum: PRODUCT_REVIEW_STATUSES,
    default: 'published',
  })
  status: ProductReviewStatus;

  createdAt: Date;
  updatedAt: Date;
}

export const ProductReviewSchema = SchemaFactory.createForClass(ProductReview);

ProductReviewSchema.index({ productId: 1, createdAt: -1 });
ProductReviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
ProductReviewSchema.index(
  { productId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true } },
  },
);
