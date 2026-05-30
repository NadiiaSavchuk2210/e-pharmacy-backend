import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { FALLBACK_AUTHOR_AVATAR_BASE_URL } from '../product-reviews.constants';
import type { PublishedProductReviewsFilter } from '../product-reviews.types';

export function buildProductLookup(productId: string): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [{ id: productId }];

  if (Types.ObjectId.isValid(productId)) {
    conditions.push({ _id: new Types.ObjectId(productId) });
  }

  return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

export function buildPublishedProductReviewsFilter(
  productId: Types.ObjectId,
): PublishedProductReviewsFilter {
  return {
    productId,
    status: 'published',
  };
}

export function buildFallbackAuthorAvatarUrl(authorName: string): string {
  return `${FALLBACK_AUTHOR_AVATAR_BASE_URL}${encodeURIComponent(authorName)}`;
}

export function toUserObjectId(userId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(userId)) {
    throw new BadRequestException('Invalid authenticated user id');
  }

  return new Types.ObjectId(userId);
}

export function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function isRating(value: number): value is 1 | 2 | 3 | 4 | 5 {
  return value >= 1 && value <= 5;
}
