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
