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
import {
  type StoresListResponse,
  type StoreResponse,
} from './types/store-response.type';

@Injectable()
export class StoresService {
  constructor(
    @InjectModel(Store.name)
    private readonly storeModel: Model<StoreDocument>,
    @InjectModel(NearestStore.name)
    private readonly nearestStoreModel: Model<NearestStoreDocument>,
  ) {}

  async findAll(query: QueryStoresDto = {}): Promise<StoresListResponse> {
    const { limit = 9, page = 1, random = false } = query;
    const skip = (page - 1) * limit;

    if (random) {
      const stores = await this.storeModel.aggregate<Store>([
        { $sample: { size: limit } },
      ]);

      return stores.map((store) => this.withDefaultIsOpen(store));
    }

    const [stores, totalItems] = await Promise.all([
      this.storeModel.find().sort({ name: 1 }).skip(skip).limit(limit).lean(),
      this.storeModel.countDocuments(),
    ]);

    return {
      items: stores.map((store) => this.withDefaultIsOpen(store)),
      meta: {
        totalItems,
        currentPage: page,
        perPage: limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    };
  }

  async findNearest(
    query: QueryNearestStoresDto = {},
  ): Promise<StoreResponse[]> {
    const { limit = 10 } = query;

    const stores = await this.nearestStoreModel
      .find()
      .sort({ rating: -1, name: 1 })
      .limit(limit)
      .lean();

    return stores.map((store) => this.withDefaultIsOpen(store));
  }

  async findRandomNearest(
    query: QueryNearestStoresDto = {},
  ): Promise<StoreResponse[]> {
    const { limit = 6 } = query;

    const stores = await this.nearestStoreModel.aggregate<NearestStore>([
      { $sample: { size: limit } },
    ]);

    return stores.map((store) => this.withDefaultIsOpen(store));
  }

  async findOne(id: string): Promise<StoreResponse> {
    const filters: Record<string, unknown>[] = [{ id }];

    if (Types.ObjectId.isValid(id)) {
      filters.push({ _id: new Types.ObjectId(id) });
    }

    const store =
      (await this.storeModel.findOne({ $or: filters }).lean()) ??
      (await this.nearestStoreModel.findOne({ $or: filters }).lean());

    if (!store) throw new NotFoundException('Store not found');
    return this.withDefaultIsOpen(store);
  }

  private withDefaultIsOpen<T extends Store | NearestStore>(
    store: T,
  ): T & { isOpen: boolean } {
    return {
      ...store,
      isOpen: store.isOpen ?? true,
    };
  }
}
