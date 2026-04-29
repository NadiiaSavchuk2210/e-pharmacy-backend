import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PRODUCT_CATEGORIES, type ProductCategory } from '../products.types';

export type ProductDocument = HydratedDocument<Product>;

@Schema({
  collection: 'products',
  timestamps: true,
  versionKey: false,
})
export class Product {
  @Prop({ required: true, unique: true, trim: true })
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

  @Prop({ required: true, type: String, enum: PRODUCT_CATEGORIES })
  category: ProductCategory;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
