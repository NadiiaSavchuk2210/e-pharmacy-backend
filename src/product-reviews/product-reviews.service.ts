import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthenticatedUser } from '../user/types/authenticated-request.type';
import {
  Product,
  type ProductDocument,
} from '../products/schemas/product.schema';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import {
  ProductReview,
  type ProductReviewDocument,
} from './schemas/product-review.schema';
import type {
  ProductReviewResponse,
  ProductReviewsPage,
  ProductReviewsSummary,
} from './product-reviews.types';
import { QueryProductReviewsDto } from './dto/query-product-reviews.dto';
import {
  buildFallbackAuthorAvatarUrl,
  buildProductLookup,
  buildPublishedProductReviewsFilter,
  isRating,
  toIsoString,
  toUserObjectId,
} from './helpers/product-reviews.helpers';
import { getOptionalAvatar } from '../user/helpers/user.helpers';
import { DEFAULT_REVIEWS_LIMIT } from './product-reviews.constants';

type ProductLookup = Product & {
  _id: Types.ObjectId;
};

type ProductReviewRecord = ProductReview & {
  _id: Types.ObjectId | string;
  createdAt: Date | string;
};

type RatingCount = {
  _id: number;
  count: number;
};

@Injectable()
export class ProductReviewsService {
  constructor(
    @InjectModel(ProductReview.name)
    private readonly productReviewModel: Model<ProductReviewDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async findByProductId(
    productId: string,
    query: QueryProductReviewsDto = {},
  ): Promise<ProductReviewsPage> {
    const product = await this.findProductOrThrow(productId);
    const { limit = DEFAULT_REVIEWS_LIMIT, page = 1 } = query;
    const skip = (page - 1) * limit;
    const filters = buildPublishedProductReviewsFilter(product._id);
    const [reviews, totalItems] = await Promise.all([
      this.productReviewModel
        .find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<ProductReviewRecord[]>(),
      this.productReviewModel.countDocuments(filters),
    ]);

    return {
      items: reviews.map((review) => this.toResponse(review, product.id)),
      meta: {
        totalItems,
        currentPage: page,
        perPage: limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    };
  }

  async create(
    productId: string,
    createProductReviewDto: CreateProductReviewDto,
    authenticatedUser?: AuthenticatedUser,
  ): Promise<ProductReviewResponse> {
    const product = await this.findProductOrThrow(productId);
    const authorName =
      authenticatedUser?.name ?? createProductReviewDto.authorName;

    if (!authorName) {
      throw new BadRequestException('authorName is required');
    }

    const userId = authenticatedUser
      ? toUserObjectId(authenticatedUser.sub)
      : undefined;
    const authorAvatar =
      (authenticatedUser ? getOptionalAvatar(authenticatedUser) : undefined) ??
      createProductReviewDto.authorAvatar ??
      buildFallbackAuthorAvatarUrl(authorName);

    const createdReview = await this.productReviewModel.create({
      productId: product._id,
      userId,
      authorName,
      authorAvatar,
      rating: createProductReviewDto.rating,
      comment: createProductReviewDto.comment,
      status: 'published',
    });

    return this.toResponse(createdReview.toObject(), product.id);
  }

  async getSummary(productId: string): Promise<ProductReviewsSummary> {
    const product = await this.findProductOrThrow(productId);
    const ratingCounts = await this.productReviewModel.aggregate<RatingCount>([
      {
        $match: {
          productId: product._id,
          status: 'published',
        },
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);
    const ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    for (const ratingCount of ratingCounts) {
      if (isRating(ratingCount._id)) {
        ratingBreakdown[ratingCount._id] = ratingCount.count;
      }
    }

    const totalReviews = Object.values(ratingBreakdown).reduce(
      (total, count) => total + count,
      0,
    );
    const totalRating = Object.entries(ratingBreakdown).reduce(
      (total, [rating, count]) => total + Number(rating) * count,
      0,
    );

    return {
      averageRating:
        totalReviews > 0 ? Number((totalRating / totalReviews).toFixed(2)) : 0,
      totalReviews,
      ratingBreakdown,
    };
  }

  private async findProductOrThrow(productId: string): Promise<ProductLookup> {
    const product = await this.productModel
      .findOne(buildProductLookup(productId))
      .lean<ProductLookup>();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private toResponse(
    review: ProductReviewRecord,
    publicProductId: string,
  ): ProductReviewResponse {
    return {
      id: String(review._id),
      productId: publicProductId,
      authorName: review.authorName,
      authorAvatar:
        review.authorAvatar ?? buildFallbackAuthorAvatarUrl(review.authorName),
      rating: review.rating,
      comment: review.comment,
      createdAt: toIsoString(review.createdAt),
    };
  }
}
