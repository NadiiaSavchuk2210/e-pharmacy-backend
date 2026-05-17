import {
  type NearestStore,
  type Store,
  type StoreStatus,
} from '../schemas/store.schema';

export type StoreResponse = (Store | NearestStore) & { status: StoreStatus };
