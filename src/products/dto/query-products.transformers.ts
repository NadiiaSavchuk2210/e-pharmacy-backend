import { type TransformFnParams } from 'class-transformer';
import { PRODUCT_CATEGORIES } from '../products.types';

export function trimQueryValue({
  value,
}: TransformFnParams): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

export function normalizeCategory({
  value,
}: TransformFnParams): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  const normalizedCategory = PRODUCT_CATEGORIES.find(
    (category) => category.toLowerCase() === trimmedValue.toLowerCase(),
  );

  return normalizedCategory ?? trimmedValue;
}
