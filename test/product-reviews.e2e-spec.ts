import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { Types } from 'mongoose';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { ProductReviewsController } from '../src/product-reviews/product-reviews.controller';
import { ProductReviewsService } from '../src/product-reviews/product-reviews.service';
import { ProductReview } from '../src/product-reviews/schemas/product-review.schema';
import { Product } from '../src/products/schemas/product.schema';
import { OptionalAuthGuard } from '../src/user/guards/optional-auth.guard';
import { UserService } from '../src/user/user.service';

type QueryFixture<T> = {
  lean: () => Promise<T>;
  sort: () => QueryFixture<T>;
  skip: () => QueryFixture<T>;
  limit: () => QueryFixture<T>;
};

function queryResult<T>(value: T): QueryFixture<T> {
  const query: QueryFixture<T> = {
    lean: () => Promise.resolve(value),
    sort: () => query,
    skip: () => query,
    limit: () => query,
  };

  return query;
}

describe('Product reviews HTTP flow (e2e)', () => {
  let app: INestApplication<App> & NestExpressApplication;
  let productFindOneMock: jest.Mock;
  let reviewFindMock: jest.Mock;
  let reviewCountDocumentsMock: jest.Mock;
  let reviewCreateMock: jest.Mock;
  let reviewAggregateMock: jest.Mock;

  const productObjectId = new Types.ObjectId('66544c51aa4ad43070b1df10');
  const product = {
    _id: productObjectId,
    id: 'product-1',
    name: 'Aspirin',
  };
  const reviews = [
    {
      _id: new Types.ObjectId('66544c51aa4ad43070b1df11'),
      productId: productObjectId,
      authorName: 'Leroy Jenkins',
      authorAvatar: 'https://example.com/leroy.png',
      rating: 5,
      comment: 'Fast relief and easy to order.',
      status: 'published',
      createdAt: new Date('2026-05-27T10:00:00.000Z'),
    },
    {
      _id: new Types.ObjectId('66544c51aa4ad43070b1df12'),
      productId: productObjectId,
      authorName: 'Nadia Petrova',
      authorAvatar: 'https://example.com/nadia.png',
      rating: 4,
      comment: 'Good product, packaging was tidy.',
      status: 'published',
      createdAt: new Date('2026-05-26T09:00:00.000Z'),
    },
  ];

  beforeEach(async () => {
    productFindOneMock = jest.fn();
    reviewFindMock = jest.fn();
    reviewCountDocumentsMock = jest.fn();
    reviewCreateMock = jest.fn();
    reviewAggregateMock = jest.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProductReviewsController],
      providers: [
        ProductReviewsService,
        OptionalAuthGuard,
        {
          provide: UserService,
          useValue: {
            verifyToken: jest.fn(),
          },
        },
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

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/products/:productId/reviews returns wrapped paginated reviews', () => {
    productFindOneMock.mockReturnValue({
      lean: jest.fn().mockResolvedValue(product),
    });
    reviewFindMock.mockReturnValue(queryResult(reviews));
    reviewCountDocumentsMock.mockResolvedValue(2);

    return request(app.getHttpServer())
      .get('/api/products/product-1/reviews?limit=2&page=1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(200);
        expect(body.message).toBe('Request completed successfully');
        expect(body.data).toEqual({
          items: [
            {
              id: '66544c51aa4ad43070b1df11',
              productId: 'product-1',
              authorName: 'Leroy Jenkins',
              authorAvatar: 'https://example.com/leroy.png',
              rating: 5,
              comment: 'Fast relief and easy to order.',
              createdAt: '2026-05-27T10:00:00.000Z',
            },
            {
              id: '66544c51aa4ad43070b1df12',
              productId: 'product-1',
              authorName: 'Nadia Petrova',
              authorAvatar: 'https://example.com/nadia.png',
              rating: 4,
              comment: 'Good product, packaging was tidy.',
              createdAt: '2026-05-26T09:00:00.000Z',
            },
          ],
          meta: {
            totalItems: 2,
            currentPage: 1,
            perPage: 2,
            totalPages: 1,
          },
        });
      });
  });

  it('POST /api/products/:productId/reviews creates an anonymous review with wrapped response', () => {
    const createdAt = new Date('2026-05-28T12:00:00.000Z');

    productFindOneMock.mockReturnValue({
      lean: jest.fn().mockResolvedValue(product),
    });
    reviewCreateMock.mockResolvedValue({
      toObject: jest.fn().mockReturnValue({
        _id: new Types.ObjectId('66544c51aa4ad43070b1df13'),
        productId: productObjectId,
        authorName: 'Anonymous Buyer',
        authorAvatar:
          'https://ui-avatars.com/api/?background=E5E7EB&color=374151&name=Anonymous%20Buyer',
        rating: 4,
        comment: 'Helpful product.',
        status: 'published',
        createdAt,
      }),
    });

    return request(app.getHttpServer())
      .post('/api/products/product-1/reviews')
      .send({
        authorName: 'Anonymous Buyer',
        rating: 4,
        comment: 'Helpful product.',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(reviewCreateMock).toHaveBeenCalledWith({
          productId: productObjectId,
          userId: undefined,
          authorName: 'Anonymous Buyer',
          authorAvatar:
            'https://ui-avatars.com/api/?background=E5E7EB&color=374151&name=Anonymous%20Buyer',
          rating: 4,
          comment: 'Helpful product.',
          status: 'published',
        });
        expect(body.statusCode).toBe(201);
        expect(body.message).toBe('Resource created successfully');
        expect(body.data).toEqual({
          id: '66544c51aa4ad43070b1df13',
          productId: 'product-1',
          authorName: 'Anonymous Buyer',
          authorAvatar:
            'https://ui-avatars.com/api/?background=E5E7EB&color=374151&name=Anonymous%20Buyer',
          rating: 4,
          comment: 'Helpful product.',
          createdAt: '2026-05-28T12:00:00.000Z',
        });
      });
  });

  it('returns validation error body for invalid review input', () => {
    return request(app.getHttpServer())
      .post('/api/products/product-1/reviews')
      .send({
        authorName: 'Anonymous Buyer',
        rating: 6,
        comment: '',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(400);
        expect(body.error).toBe('BAD_REQUEST');
        expect(body.path).toBe('/api/products/product-1/reviews');
        expect(body.message).toEqual(
          expect.arrayContaining([
            'rating must not be greater than 5',
            'comment should not be empty',
          ]),
        );
        expect(productFindOneMock).not.toHaveBeenCalled();
        expect(reviewCreateMock).not.toHaveBeenCalled();
      });
  });

  it('returns 404 when creating a review for a missing product', () => {
    productFindOneMock.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    return request(app.getHttpServer())
      .post('/api/products/missing-product/reviews')
      .send({
        authorName: 'Anonymous Buyer',
        rating: 4,
        comment: 'This should fail.',
      })
      .expect(404)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(404);
        expect(body.message).toBe('Product not found');
        expect(body.error).toBe('NOT_FOUND');
        expect(body.path).toBe('/api/products/missing-product/reviews');
        expect(reviewCreateMock).not.toHaveBeenCalled();
      });
  });
});
