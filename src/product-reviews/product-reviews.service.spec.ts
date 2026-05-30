import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Product } from '../products/schemas/product.schema';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { ProductReviewsService } from './product-reviews.service';
import { ProductReview } from './schemas/product-review.schema';

describe('ProductReviewsService', () => {
  let service: ProductReviewsService;
  let productFindOneMock: jest.Mock;
  let productLeanMock: jest.Mock;
  let reviewFindMock: jest.Mock;
  let reviewSortMock: jest.Mock;
  let reviewSkipMock: jest.Mock;
  let reviewLimitMock: jest.Mock;
  let reviewLeanMock: jest.Mock;
  let reviewCountDocumentsMock: jest.Mock;
  let reviewCreateMock: jest.Mock;
  let reviewAggregateMock: jest.Mock;

  const productObjectId = new Types.ObjectId('66544c51aa4ad43070b1df10');
  const product = {
    _id: productObjectId,
    id: 'product-1',
    name: 'Aspirin',
  };
  const seedReviews = [
    {
      _id: new Types.ObjectId('66544c51aa4ad43070b1df11'),
      productId: productObjectId,
      authorName: 'Leroy Jenkins',
      rating: 5,
      comment: 'Fast relief and easy to order.',
      status: 'published',
      createdAt: new Date('2026-05-27T10:00:00.000Z'),
    },
    {
      _id: new Types.ObjectId('66544c51aa4ad43070b1df12'),
      productId: productObjectId,
      authorName: 'Nadia Petrova',
      rating: 4,
      comment: 'Good product, packaging was tidy.',
      status: 'published',
      createdAt: new Date('2026-05-26T09:00:00.000Z'),
    },
    {
      _id: new Types.ObjectId('66544c51aa4ad43070b1df13'),
      productId: productObjectId,
      authorName: 'Ivan Shevchenko',
      rating: 3,
      comment: 'Worked fine after a few days.',
      status: 'published',
      createdAt: new Date('2026-05-25T08:00:00.000Z'),
    },
  ];

  beforeEach(async () => {
    productFindOneMock = jest.fn();
    productLeanMock = jest.fn();
    reviewFindMock = jest.fn();
    reviewSortMock = jest.fn();
    reviewSkipMock = jest.fn();
    reviewLimitMock = jest.fn();
    reviewLeanMock = jest.fn();
    reviewCountDocumentsMock = jest.fn();
    reviewCreateMock = jest.fn();
    reviewAggregateMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductReviewsService,
        {
          provide: getModelToken(ProductReview.name),
          useValue: {
            find: reviewFindMock,
            countDocuments: reviewCountDocumentsMock,
            create: reviewCreateMock,
            aggregate: reviewAggregateMock,
          },
        },
        {
          provide: getModelToken(Product.name),
          useValue: {
            findOne: productFindOneMock,
          },
        },
      ],
    }).compile();

    service = module.get<ProductReviewsService>(ProductReviewsService);
    productFindOneMock.mockReturnValue({ lean: productLeanMock });
    reviewFindMock.mockReturnValue({ sort: reviewSortMock });
    reviewSortMock.mockReturnValue({ skip: reviewSkipMock });
    reviewSkipMock.mockReturnValue({ limit: reviewLimitMock });
    reviewLimitMock.mockReturnValue({ lean: reviewLeanMock });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('fetches only reviews for the requested product sorted newest first', async () => {
    productLeanMock.mockResolvedValue(product);
    reviewLeanMock.mockResolvedValue(seedReviews);
    reviewCountDocumentsMock.mockResolvedValue(3);

    const result = await service.findByProductId('product-1');

    expect(productFindOneMock).toHaveBeenCalledWith({ id: 'product-1' });
    expect(reviewFindMock).toHaveBeenCalledWith({
      productId: productObjectId,
      status: 'published',
    });
    expect(reviewSortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(reviewSkipMock).toHaveBeenCalledWith(0);
    expect(reviewLimitMock).toHaveBeenCalledWith(50);
    expect(reviewCountDocumentsMock).toHaveBeenCalledWith({
      productId: productObjectId,
      status: 'published',
    });
    expect(result).toEqual({
      items: [
        {
          id: '66544c51aa4ad43070b1df11',
          productId: 'product-1',
          authorName: 'Leroy Jenkins',
          authorAvatar:
            'https://ui-avatars.com/api/?background=E5E7EB&color=374151&name=Leroy%20Jenkins',
          rating: 5,
          comment: 'Fast relief and easy to order.',
          createdAt: '2026-05-27T10:00:00.000Z',
        },
        {
          id: '66544c51aa4ad43070b1df12',
          productId: 'product-1',
          authorName: 'Nadia Petrova',
          authorAvatar:
            'https://ui-avatars.com/api/?background=E5E7EB&color=374151&name=Nadia%20Petrova',
          rating: 4,
          comment: 'Good product, packaging was tidy.',
          createdAt: '2026-05-26T09:00:00.000Z',
        },
        {
          id: '66544c51aa4ad43070b1df13',
          productId: 'product-1',
          authorName: 'Ivan Shevchenko',
          authorAvatar:
            'https://ui-avatars.com/api/?background=E5E7EB&color=374151&name=Ivan%20Shevchenko',
          rating: 3,
          comment: 'Worked fine after a few days.',
          createdAt: '2026-05-25T08:00:00.000Z',
        },
      ],
      meta: {
        totalItems: 3,
        currentPage: 1,
        perPage: 50,
        totalPages: 1,
      },
    });
  });

  it('returns an empty array when the product exists without reviews', async () => {
    productLeanMock.mockResolvedValue(product);
    reviewLeanMock.mockResolvedValue([]);
    reviewCountDocumentsMock.mockResolvedValue(0);

    await expect(service.findByProductId('product-1')).resolves.toEqual({
      items: [],
      meta: {
        totalItems: 0,
        currentPage: 1,
        perPage: 50,
        totalPages: 1,
      },
    });
  });

  it('applies pagination when fetching product reviews', async () => {
    productLeanMock.mockResolvedValue(product);
    reviewLeanMock.mockResolvedValue([seedReviews[2]]);
    reviewCountDocumentsMock.mockResolvedValue(3);

    const result = await service.findByProductId('product-1', {
      limit: 1,
      page: 3,
    });

    expect(reviewSkipMock).toHaveBeenCalledWith(2);
    expect(reviewLimitMock).toHaveBeenCalledWith(1);
    expect(result.meta).toEqual({
      totalItems: 3,
      currentPage: 3,
      perPage: 1,
      totalPages: 3,
    });
  });

  it('throws 404 when fetching reviews for a missing product', async () => {
    productLeanMock.mockResolvedValue(null);

    await expect(service.findByProductId('missing-product')).rejects.toThrow(
      NotFoundException,
    );
    expect(reviewFindMock).not.toHaveBeenCalled();
  });

  it('creates a review using authenticated user details when auth exists', async () => {
    const createdAt = new Date('2026-05-28T11:00:00.000Z');

    productLeanMock.mockResolvedValue(product);
    reviewCreateMock.mockResolvedValue({
      toObject: jest.fn().mockReturnValue({
        _id: new Types.ObjectId('66544c51aa4ad43070b1df14'),
        productId: productObjectId,
        userId: new Types.ObjectId('66544c51aa4ad43070b1df99'),
        authorName: 'Authenticated User',
        authorAvatar: 'https://example.com/user-avatar.png',
        rating: 5,
        comment: 'Helpful and accurate.',
        status: 'published',
        createdAt,
      }),
    });

    const result = await service.create(
      'product-1',
      {
        rating: 5,
        comment: 'Helpful and accurate.',
      },
      {
        sub: '66544c51aa4ad43070b1df99',
        email: 'user@example.com',
        name: 'Authenticated User',
        phone: '+380991112233',
        role: 'user',
        avatar: 'https://example.com/user-avatar.png',
        type: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    );

    expect(reviewCreateMock).toHaveBeenCalledWith({
      productId: productObjectId,
      userId: new Types.ObjectId('66544c51aa4ad43070b1df99'),
      authorName: 'Authenticated User',
      authorAvatar: 'https://example.com/user-avatar.png',
      rating: 5,
      comment: 'Helpful and accurate.',
      status: 'published',
    });
    expect(result).toEqual({
      id: '66544c51aa4ad43070b1df14',
      productId: 'product-1',
      authorName: 'Authenticated User',
      authorAvatar: 'https://example.com/user-avatar.png',
      rating: 5,
      comment: 'Helpful and accurate.',
      createdAt: '2026-05-28T11:00:00.000Z',
    });
  });

  it('requires authorName for anonymous review creation', async () => {
    productLeanMock.mockResolvedValue(product);

    await expect(
      service.create('product-1', {
        rating: 4,
        comment: 'Anonymous review without a name.',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(reviewCreateMock).not.toHaveBeenCalled();
  });

  it('throws 404 when creating a review for a missing product', async () => {
    productLeanMock.mockResolvedValue(null);

    await expect(
      service.create('missing-product', {
        authorName: 'Leroy Jenkins',
        rating: 4,
        comment: 'This should not be created.',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(reviewCreateMock).not.toHaveBeenCalled();
  });

  it('rejects invalid review ratings through DTO validation', async () => {
    const dto = plainToInstance(CreateProductReviewDto, {
      authorName: 'Leroy Jenkins',
      rating: 6,
      comment: 'Rating must stay within one to five.',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'rating')).toBe(true);
  });

  it('returns review summary with average and rating breakdown', async () => {
    productLeanMock.mockResolvedValue(product);
    reviewAggregateMock.mockResolvedValue([
      { _id: 5, count: 1 },
      { _id: 4, count: 1 },
      { _id: 3, count: 1 },
    ]);

    await expect(service.getSummary('product-1')).resolves.toEqual({
      averageRating: 4,
      totalReviews: 3,
      ratingBreakdown: {
        1: 0,
        2: 0,
        3: 1,
        4: 1,
        5: 1,
      },
    });
    expect(reviewAggregateMock).toHaveBeenCalledWith([
      {
        $match: {
          productId: productObjectId,
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
  });
});
