import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
    const { limit = 50, random = false } = query;

    if (random) {
      const stores = await this.storeModel.aggregate<Store>([
        { $sample: { size: limit } },
      ]);

      return stores.map((store) => this.withDefaultStatus(store));
    }

    const stores = await this.storeModel
      .find()
      .sort({ name: 1 })
      .limit(limit)
      .lean();

    return stores.map((store) => this.withDefaultStatus(store));
  }

  async findNearest(query: QueryNearestStoresDto = {}) {
    const { limit = 10 } = query;

    const stores = await this.nearestStoreModel
      .find()
      .sort({ rating: -1, name: 1 })
      .limit(limit)
      .lean();

    return stores.map((store) => this.withDefaultStatus(store));
  }

  async findOne(id: string) {
    const filters: Record<string, unknown>[] = [{ id }];

    if (Types.ObjectId.isValid(id)) {
      filters.push({ _id: new Types.ObjectId(id) });
    }

    const store = await this.storeModel.findOne({ $or: filters }).lean();

    if (!store) throw new NotFoundException('Store not found');
    return this.withDefaultStatus(store);
  }

  private withDefaultStatus<T extends { status?: unknown }>(store: T) {
    return {
      ...store,
      status: store.status ?? 'OPEN',
    };
  }
}
