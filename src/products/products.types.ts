export const PRODUCT_CATEGORIES = [
  'Medicine',
  'Heart',
  'Head',
  'Hand',
  'Leg',
  'Dental Care',
  'Skin Care',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface ProductsQuery {
  category?: ProductCategory;
  name?: string;
}

export interface Product {
  id: string;
  photo: string;
  name: string;
  suppliers: string;
  stock: string;
  price: string;
  category: ProductCategory;
}

export function isProductCategory(value: string): value is ProductCategory {
  return PRODUCT_CATEGORIES.includes(value as ProductCategory);
}
