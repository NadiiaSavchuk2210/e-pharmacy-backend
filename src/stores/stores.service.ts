import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QueryNearestStoresDto } from './dto/query-nearest-stores.dto';
import { QueryStoresDto } from './dto/query-stores.dto';
import {
  NearestStore,
  type NearestStoreDocument,
  Store,
  type StoreDocument,
} from './schemas/store.schema';

@Injectable()
export class StoresService {
  constructor(
    @InjectModel(Store.name)
    private readonly storeModel: Model<StoreDocument>,
    @InjectModel(NearestStore.name)
    private readonly nearestStoreModel: Model<NearestStoreDocument>,
  ) {}

  async findAll(query: QueryStoresDto = {}) {
    const { limit = 50 } = query;

    return this.storeModel.find().sort({ name: 1 }).limit(limit).lean();
  }

  async findNearest(query: QueryNearestStoresDto = {}) {
    const { limit = 10 } = query;

    return this.nearestStoreModel
      .find()
      .sort({ rating: -1, name: 1 })
      .limit(limit)
      .lean();
  }
}
