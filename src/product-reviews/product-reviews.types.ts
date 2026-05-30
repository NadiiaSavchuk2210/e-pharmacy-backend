import { Types } from 'mongoose';

export type ProductReviewResponse = {
  id: string;
  productId: string;
  authorName: string;
  authorAvatar: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type ProductReviewsPage = {
  items: ProductReviewResponse[];
  meta: {
    totalItems: number;
    currentPage: number;
    perPage: number;
    totalPages: number;
  };
};

export type ProductReviewsSummary = {
  averageRating: number;
  totalReviews: number;
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
};

export type PublishedProductReviewsFilter = {
  productId: Types.ObjectId;
  status: 'published';
};
