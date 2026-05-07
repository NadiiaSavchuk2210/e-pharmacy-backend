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

export function parseLimit({ value }: TransformFnParams): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsedValue = Number.parseInt(String(value), 10);

  return Number.isNaN(parsedValue) ? undefined : parsedValue;
}
