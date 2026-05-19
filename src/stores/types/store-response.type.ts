import { type StoreBase } from '../schemas/store.schema';

export type StoreResponse = StoreBase & { isOpen: boolean };

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
