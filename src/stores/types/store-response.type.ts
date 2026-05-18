import { type StoreBase, type StoreStatus } from '../schemas/store.schema';

export type StoreResponse = StoreBase & { status: StoreStatus };

export type StoresPage = {
  items: StoreResponse[];
  meta: {
    totalItems: number;
    currentPage: number;
    perPage: number;
    totalPages: number;
  };
};

export type StoresListResponse = StoreResponse[] | StoresPage;
