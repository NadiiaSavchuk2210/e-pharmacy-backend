import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { CartController } from '../src/cart/cart.controller';
import { CartService } from '../src/cart/cart.service';
import { Cart } from '../src/cart/schemas/cart.schema';
import { Order } from '../src/cart/schemas/order.schema';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { OrdersController } from '../src/orders/orders.controller';
import { OrdersService } from '../src/orders/orders.service';
import { Product } from '../src/products/schemas/product.schema';
import { AuthGuard } from '../src/user/guards/auth.guard';

const user = {
  sub: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  phone: '+380991112233',
  role: 'user',
  type: 'access',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const product = {
  _id: 'mongo-product-1',
  id: 'product-1',
  photo: 'photo.png',
  name: 'Aspirin',
  suppliers: 'Acme Pharma',
  stock: '5',
  price: '12.50',
  category: 'Medicine',
  discount: 0,
};

type CartItemFixture = {
  productId: string;
  quantity: number;
};

type QueryFixture<T> = {
  lean: () => Promise<T>;
  session: () => QueryFixture<T>;
  sort: () => QueryFixture<T>;
};

function queryResult<T>(value: T) {
  const query: QueryFixture<T> = {
    lean: () => Promise.resolve(value),
    session: () => query,
    sort: () => query,
  };

  return query;
}

function sessionResult<T>(value: T) {
  return {
    session: jest.fn().mockResolvedValue(value),
  };
}

function createCartDoc(items: CartItemFixture[]) {
  const doc = {
    items,
    set: jest.fn((path: string, value: CartItemFixture[]) => {
      if (path === 'items') {
        doc.items = value;
      }
    }),
    save: jest.fn().mockResolvedValue(undefined),
  };

  return doc;
}

type CartDocFixture = ReturnType<typeof createCartDoc>;

function cartFindOneResult(getCart: () => CartDocFixture | null) {
  const resolveCart = () => Promise.resolve(getCart());

  return {
    lean: jest.fn(async () => {
      const cart = getCart();

      return cart ? { items: cart.items } : null;
    }),
    session: jest.fn(resolveCart),
    then: (onFulfilled, onRejected) =>
      resolveCart().then(onFulfilled, onRejected),
    catch: (onRejected) => resolveCart().catch(onRejected),
  };
}

describe('Cart and Orders HTTP flow (e2e)', () => {
  let app: INestApplication<App> & NestExpressApplication;
  let cartFindOneMock: jest.Mock;
  let cartCreateMock: jest.Mock;
  let orderCreateMock: jest.Mock;
  let orderFindMock: jest.Mock;
  let orderFindOneMock: jest.Mock;
  let productFindOneMock: jest.Mock;
  let productFindMock: jest.Mock;
  let productUpdateOneMock: jest.Mock;
  let connectionTransactionMock: jest.Mock;
  const session = { id: 'session-1' };

  beforeEach(async () => {
    cartFindOneMock = jest.fn();
    cartCreateMock = jest.fn();
    orderCreateMock = jest.fn();
    orderFindMock = jest.fn();
    orderFindOneMock = jest.fn();
    productFindOneMock = jest.fn();
    productFindMock = jest.fn();
    productUpdateOneMock = jest.fn();
    connectionTransactionMock = jest.fn(
      (callback: (value: unknown) => unknown) =>
        Promise.resolve(callback(session)),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CartController, OrdersController],
      providers: [
        CartService,
        OrdersService,
        {
          provide: getModelToken(Cart.name),
          useValue: {
            findOne: cartFindOneMock,
            create: cartCreateMock,
          },
        },
        {
          provide: getModelToken(Order.name),
          useValue: {
            create: orderCreateMock,
            find: orderFindMock,
            findOne: orderFindOneMock,
          },
        },
        {
          provide: getModelToken(Product.name),
          useValue: {
            findOne: productFindOneMock,
            find: productFindMock,
            updateOne: productUpdateOneMock,
          },
        },
        {
          provide: getConnectionToken(),
          useValue: {
            transaction: connectionTransactionMock,
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          request.user = user;
          request.token = 'test-token';
          return true;
        },
      })
      .compile();

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

  it('quotes delivery fees through the real HTTP layer', () => {
    cartFindOneMock.mockReturnValue(
      queryResult({
        items: [
          {
            productId: 'product-1',
            quantity: 40,
          },
        ],
      }),
    );
    productFindMock.mockReturnValue(queryResult([product]));

    return request(app.getHttpServer())
      .post('/api/cart/delivery-quote')
      .set('Authorization', 'Bearer test-token')
      .send({
        address: 'Kyiv, Main 1',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          subtotal: 500,
          deliveryFee: 0,
          additionalFee: 0,
          freeDeliveryThreshold: 500,
          amountToFreeDelivery: 0,
          message:
            'Delivery and extra fees are calculated based on shipping address',
        });
      });
  });

  it('updates, reads, and checks out the authenticated user server-side cart', async () => {
    let savedCart: CartDocFixture | null = null;
    const createdAt = new Date('2026-05-25T10:00:00.000Z');

    cartFindOneMock.mockImplementation(() =>
      cartFindOneResult(() => savedCart),
    );
    cartCreateMock.mockImplementation(async ({ items }) => {
      savedCart = createCartDoc(items);
      return savedCart;
    });
    productFindOneMock.mockReturnValue(queryResult(product));
    productFindMock.mockReturnValue(queryResult([product]));
    productUpdateOneMock.mockResolvedValue({ modifiedCount: 1 });
    orderCreateMock.mockResolvedValue([
      {
        _id: '66544c51aa4ad43070b1df10',
        items: [
          {
            productId: 'product-1',
            name: 'Aspirin',
            price: 12.5,
            quantity: 2,
            total: 25,
          },
        ],
        shippingInfo: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '+380991112233',
          address: 'Kyiv, Main 1',
        },
        paymentMethod: 'cash_on_delivery',
        subtotal: 25,
        deliveryFee: 50,
        additionalFee: 0,
        total: 75,
        status: 'pending',
        createdAt,
      },
    ]);

    await request(app.getHttpServer())
      .put('/api/cart/update')
      .set('Authorization', 'Bearer test-token')
      .send({
        productId: 'product-1',
        quantity: 2,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(1);
        expect(body.items[0].quantity).toBe(2);
        expect(body.totalItems).toBe(2);
      });

    await request(app.getHttpServer())
      .get('/api/cart')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(1);
        expect(body.items[0].product.id).toBe('product-1');
        expect(body.totalPrice).toBe(25);
      });

    await request(app.getHttpServer())
      .post('/api/cart/checkout')
      .set('Authorization', 'Bearer test-token')
      .send({
        shippingInfo: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '+380991112233',
          address: 'Kyiv, Main 1',
        },
        paymentMethod: 'cash_on_delivery',
        comment: '',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(orderCreateMock).toHaveBeenCalledWith(
          [
            expect.objectContaining({
              userId: 'user-1',
              paymentMethod: 'cash_on_delivery',
              subtotal: 25,
              total: 75,
            }),
          ],
          { session },
        );
        expect(savedCart?.items).toEqual([]);
        expect(body.order.items[0]).toEqual({
          productId: 'product-1',
          name: 'Aspirin',
          price: 12.5,
          quantity: 2,
          total: 25,
        });
      });
  });

  it('rejects checkout items because checkout uses the server-side cart', () => {
    return request(app.getHttpServer())
      .post('/api/cart/checkout')
      .set('Authorization', 'Bearer test-token')
      .send({
        items: [
          {
            productId: 'product-1',
            quantity: 2,
          },
        ],
        shippingInfo: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '+380991112233',
          address: 'Kyiv, Main 1',
        },
        paymentMethod: 'cash_on_delivery',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toContain('property items should not exist');
        expect(connectionTransactionMock).not.toHaveBeenCalled();
      });
  });

  it('checks out the current cart transactionally through the real HTTP layer', () => {
    const cartDoc = createCartDoc([
      {
        productId: 'product-1',
        quantity: 2,
      },
    ]);
    const createdAt = new Date('2026-05-25T10:00:00.000Z');

    cartFindOneMock.mockReturnValue(sessionResult(cartDoc));
    productFindMock.mockReturnValue(queryResult([product]));
    productUpdateOneMock.mockResolvedValue({ modifiedCount: 1 });
    orderCreateMock.mockResolvedValue([
      {
        _id: '66544c51aa4ad43070b1df10',
        items: [
          {
            productId: 'product-1',
            name: 'Aspirin',
            price: 12.5,
            quantity: 2,
            total: 25,
          },
        ],
        shippingInfo: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '+380991112233',
          address: 'Kyiv, Main 1',
        },
        paymentMethod: 'cash_on_delivery',
        subtotal: 25,
        deliveryFee: 50,
        additionalFee: 0,
        total: 75,
        status: 'pending',
        createdAt,
      },
    ]);

    return request(app.getHttpServer())
      .post('/api/cart/checkout')
      .set('Authorization', 'Bearer test-token')
      .send({
        shippingInfo: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '+380991112233',
          address: 'Kyiv, Main 1',
        },
        paymentMethod: 'cash_on_delivery',
        comment: '',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(connectionTransactionMock).toHaveBeenCalledTimes(1);
        expect(productUpdateOneMock).toHaveBeenCalledWith(
          {
            _id: 'mongo-product-1',
            $expr: {
              $gte: [
                {
                  $convert: {
                    input: '$stock',
                    to: 'int',
                    onError: -1,
                    onNull: -1,
                  },
                },
                2,
              ],
            },
          },
          [
            {
              $set: {
                stock: {
                  $toString: {
                    $subtract: [
                      {
                        $convert: {
                          input: '$stock',
                          to: 'int',
                          onError: 0,
                          onNull: 0,
                        },
                      },
                      2,
                    ],
                  },
                },
              },
            },
          ],
          { session, updatePipeline: true },
        );
        expect(cartDoc.save).toHaveBeenCalledWith({ session });
        expect(body.order.total).toBe(75);
        expect(body.order.items[0]).toEqual({
          productId: 'product-1',
          name: 'Aspirin',
          price: 12.5,
          quantity: 2,
          total: 25,
        });
      });
  });

  it('returns order history for the authenticated user', () => {
    orderFindMock.mockReturnValue(
      queryResult([
        {
          _id: '66544c51aa4ad43070b1df10',
          items: [
            {
              productId: 'product-1',
              name: 'Aspirin',
              price: 12.5,
              quantity: 2,
              total: 25,
            },
          ],
          shippingInfo: {
            name: 'Test User',
            email: 'test@example.com',
            phone: '+380991112233',
            address: 'Kyiv, Main 1',
          },
          paymentMethod: 'cash_on_delivery',
          subtotal: 25,
          deliveryFee: 50,
          additionalFee: 0,
          total: 75,
          status: 'pending',
          createdAt: new Date('2026-05-25T10:00:00.000Z'),
        },
      ]),
    );

    return request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(orderFindMock).toHaveBeenCalledWith({ userId: 'user-1' });
        expect(body.orders).toHaveLength(1);
        expect(body.orders[0].id).toBe('66544c51aa4ad43070b1df10');
        expect(body.orders[0].total).toBe(75);
      });
  });

  it('updates an order status through an allowed transition', () => {
    const orderDoc = {
      _id: '66544c51aa4ad43070b1df10',
      items: [],
      shippingInfo: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+380991112233',
        address: 'Kyiv, Main 1',
      },
      paymentMethod: 'bank',
      subtotal: 0,
      deliveryFee: 0,
      additionalFee: 0,
      total: 0,
      status: 'pending',
      createdAt: new Date('2026-05-25T10:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined),
    };

    orderFindOneMock.mockResolvedValue(orderDoc);

    return request(app.getHttpServer())
      .patch('/api/orders/66544c51aa4ad43070b1df10/status')
      .set('Authorization', 'Bearer test-token')
      .send({ status: 'paid' })
      .expect(200)
      .expect(({ body }) => {
        expect(orderDoc.status).toBe('paid');
        expect(orderDoc.save).toHaveBeenCalledTimes(1);
        expect(body.order.status).toBe('paid');
      });
  });
});
