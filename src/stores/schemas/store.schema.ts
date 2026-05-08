import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoreDocument = HydratedDocument<Store>;
export type NearestStoreDocument = HydratedDocument<NearestStore>;

@Schema({
  collection: 'pharmacies',
  timestamps: true,
  versionKey: false,
})
export class Store {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, min: 0, max: 5 })
  rating: number;
}

@Schema({
  collection: 'nearest_pharmacies',
  timestamps: true,
  versionKey: false,
})
export class NearestStore {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, min: 0, max: 5 })
  rating: number;
}

export const StoreSchema = SchemaFactory.createForClass(Store);
export const NearestStoreSchema = SchemaFactory.createForClass(NearestStore);

StoreSchema.index({ name: 1 });
NearestStoreSchema.index({ rating: -1, name: 1 });
