import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { PRODUCT_CATEGORIES, type ProductCategory } from '../products.types';

export type ProductDocument = HydratedDocument<Product>;

@Schema({
  _id: false,
})
class ProductDescriptionSection {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  body: string;
}

const ProductDescriptionSectionSchema = SchemaFactory.createForClass(
  ProductDescriptionSection,
);

@Schema({
  collection: 'products',
  timestamps: true,
  versionKey: false,
})
export class Product {
  @Prop({ required: true, trim: true })
  id: string;

  @Prop({ required: true, trim: true })
  photo: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  suppliers: string;

  @Prop({ required: true, trim: true })
  stock: string;

  @Prop({ required: true, trim: true })
  price: string;

  @Prop({ required: false, type: MongooseSchema.Types.Mixed })
  discount?: number | string;

  @Prop({ required: true, type: String, enum: PRODUCT_CATEGORIES })
  category: ProductCategory;

  @Prop({ required: false, trim: true })
  description?: string;

  @Prop({
    required: false,
    type: [ProductDescriptionSectionSchema],
    default: undefined,
  })
  descriptionSections?: ProductDescriptionSection[];

  @Prop({ required: false, trim: true })
  sourceUrl?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ id: 1 }, { unique: true, name: 'uniq_products_id' });
ProductSchema.index({ category: 1, name: 1 });
ProductSchema.index({ discount: 1 });
