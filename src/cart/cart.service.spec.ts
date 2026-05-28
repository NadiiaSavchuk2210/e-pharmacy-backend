import { Logger } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Product } from '../products/schemas/product.schema';
import { CartService } from './cart.service';
import { Cart } from './schemas/cart.schema';
import { Order } from './schemas/order.schema';

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

type CartDocFixture = {
  items: CartItemFixture[];
  set: jest.Mock;
  save: jest.Mock;
};

type LeanQueryFixture<T> = {
  lean: () => Promise<T>;
  session: () => LeanQueryFixture<T>;
};

function leanResult<T>(value: T) {
  const query: LeanQueryFixture<T> = {
    lean: () => Promise.resolve(value),
    session: () => query,
  };

  return query;
}

function createCartDoc(items: CartItemFixture[] = []): CartDocFixture {
  const doc: CartDocFixture = {
    items,
    set: jest.fn((path: string, value: unknown) => {
      if (path === 'items') {
        doc.items = value as CartItemFixture[];
      }
    }),
    save: jest.fn().mockResolvedValue(undefined),
  };

  return doc;
}

describe('CartService', () => {
  let service: CartService;
  let cartFindOneMock: jest.Mock;
  let cartCreateMock: jest.Mock;
  let orderCreateMock: jest.Mock;
  let productFindOneMock: jest.Mock;
  let productFindMock: jest.Mock;
  let productUpdateOneMock: jest.Mock;
  let connectionTransactionMock: jest.Mock;
  const session = { id: 'session-1' };

  beforeEach(async () => {
    cartFindOneMock = jest.fn();
    cartCreateMock = jest.fn();
    orderCreateMock = jest.fn();
    productFindOneMock = jest.fn();
    productFindMock = jest.fn();
    productUpdateOneMock = jest.fn();
    connectionTransactionMock = jest.fn(
      (callback: (value: unknown) => unknown) =>
        Promise.resolve(callback(session)),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
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
    }).compile();

    service = module.get<CartService>(CartService);
  });

  it('adds a product to a new cart and returns the updated cart', async () => {
    const cartDoc = createCartDoc();

    productFindOneMock.mockReturnValue(leanResult(product));
    productFindMock.mockReturnValue(leanResult([product]));
    cartFindOneMock.mockResolvedValue(null);
    cartCreateMock.mockResolvedValue(cartDoc);

    const result = await service.updateCart('user-1', {
      productId: 'product-1',
      quantity: 2,
    });

    expect(cartCreateMock).toHaveBeenCalledWith({
      userId: 'user-1',
      items: [],
    });
    expect(cartDoc.set).toHaveBeenCalledWith('items', [
      {
        productId: 'product-1',
        quantity: 2,
      },
    ]);
    expect(result).toEqual({
      items: [
        {
          product: {
            id: 'product-1',
            _id: 'mongo-product-1',
            photo: 'photo.png',
            name: 'Aspirin',
            suppliers: 'Acme Pharma',
            stock: '5',
            price: '12.50',
            category: 'Medicine',
            discount: 0,
          },
          quantity: 2,
        },
      ],
      totalItems: 2,
      totalPrice: 25,
    });
  });

  it('removes a product when quantity is zero', async () => {
    const cartDoc = createCartDoc([
      {
        productId: 'product-1',
        quantity: 2,
      },
    ]);

    productFindOneMock.mockReturnValue(leanResult(product));
    cartFindOneMock.mockResolvedValue(cartDoc);

    const result = await service.updateCart('user-1', {
      productId: 'product-1',
      quantity: 0,
    });

    expect(cartDoc.set).toHaveBeenCalledWith('items', []);
    expect(result).toEqual({
      items: [],
      totalItems: 0,
      totalPrice: 0,
    });
  });

  it('uses discounted product prices for cart totals', async () => {
    cartFindOneMock.mockReturnValue(
      leanResult({
        items: [
          {
            productId: 'product-1',
            quantity: 2,
          },
        ],
      }),
    );
    productFindMock.mockReturnValue(
      leanResult([
        {
          ...product,
          discount: 20,
        },
      ]),
    );

    await expect(service.getCart('user-1')).resolves.toMatchObject({
      items: [
        {
          product: {
            id: 'product-1',
            price: '12.50',
            discount: 20,
          },
          quantity: 2,
        },
      ],
      totalItems: 2,
      totalPrice: 20,
    });
  });

  it('rejects quantities larger than available stock', async () => {
    productFindOneMock.mockReturnValue(
      leanResult({
        ...product,
        stock: '1',
      }),
    );

    await expect(
      service.updateCart('user-1', {
        productId: 'product-1',
        quantity: 2,
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'Not enough stock',
        statusCode: 400,
      },
      status: 400,
    });
    expect(cartFindOneMock).not.toHaveBeenCalled();
  });

  it('creates an order from the current cart, decreases stock, and clears the cart', async () => {
    const cartDoc = createCartDoc([
      {
        productId: 'product-1',
        quantity: 2,
      },
    ]);
    const createdAt = new Date('2026-05-25T10:00:00.000Z');

    cartFindOneMock.mockReturnValue({
      session: jest.fn().mockResolvedValue(cartDoc),
    });
    productFindMock.mockReturnValue(leanResult([product]));
    orderCreateMock.mockResolvedValue([
      {
        _id: 'order-1',
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
    productUpdateOneMock.mockResolvedValue({ modifiedCount: 1 });

    const result = await service.checkout('user-1', {
      shippingInfo: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+380991112233',
        address: 'Kyiv, Main 1',
      },
      paymentMethod: 'cash_on_delivery',
      comment: '',
    });

    expect(orderCreateMock).toHaveBeenCalledWith(
      [
        {
          userId: 'user-1',
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
          comment: '',
          status: 'pending',
        },
      ],
      {
        session,
      },
    );
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
    expect(cartDoc.set).toHaveBeenCalledWith('items', []);
    expect(cartDoc.save).toHaveBeenCalledWith({ session });
    expect(result).toEqual({
      order: {
        id: 'order-1',
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
        createdAt: '2026-05-25T10:00:00.000Z',
      },
    });
  });

  it('creates checkout order totals with discounted product prices', async () => {
    const cartDoc = createCartDoc([
      {
        productId: 'product-1',
        quantity: 2,
      },
    ]);
    const createdAt = new Date('2026-05-25T10:00:00.000Z');
    const discountedProduct = {
      ...product,
      discount: '20%',
    };

    cartFindOneMock.mockReturnValue({
      session: jest.fn().mockResolvedValue(cartDoc),
    });
    productFindMock.mockReturnValue(leanResult([discountedProduct]));
    orderCreateMock.mockResolvedValue([
      {
        _id: 'order-1',
        items: [
          {
            productId: 'product-1',
            name: 'Aspirin',
            price: 10,
            quantity: 2,
            total: 20,
          },
        ],
        shippingInfo: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '+380991112233',
          address: 'Kyiv, Main 1',
        },
        paymentMethod: 'cash_on_delivery',
        subtotal: 20,
        deliveryFee: 50,
        additionalFee: 0,
        total: 70,
        status: 'pending',
        createdAt,
      },
    ]);
    productUpdateOneMock.mockResolvedValue({ modifiedCount: 1 });

    const result = await service.checkout('user-1', {
      shippingInfo: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+380991112233',
        address: 'Kyiv, Main 1',
      },
      paymentMethod: 'cash_on_delivery',
      comment: '',
    });

    expect(orderCreateMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          items: [
            {
              productId: 'product-1',
              name: 'Aspirin',
              price: 10,
              quantity: 2,
              total: 20,
            },
          ],
          subtotal: 20,
          deliveryFee: 50,
          total: 70,
        }),
      ],
      {
        session,
      },
    );
    expect(result.order).toMatchObject({
      subtotal: 20,
      total: 70,
      items: [
        {
          productId: 'product-1',
          price: 10,
          quantity: 2,
          total: 20,
        },
      ],
    });
  });

  it('falls back to sequential checkout in non-production when transactions are unavailable', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const cartDoc = createCartDoc([
      {
        productId: 'product-1',
        quantity: 2,
      },
    ]);
    const createdAt = new Date('2026-05-25T10:00:00.000Z');

    process.env.NODE_ENV = 'development';
    connectionTransactionMock.mockRejectedValueOnce(
      new Error(
        'Transaction numbers are only allowed on a replica set member or mongos',
      ),
    );
    cartFindOneMock.mockResolvedValue(cartDoc);
    productFindMock.mockReturnValue(leanResult([product]));
    orderCreateMock.mockResolvedValue([
      {
        _id: 'order-1',
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
    productUpdateOneMock.mockResolvedValue({ modifiedCount: 1 });

    try {
      const result = await service.checkout('user-1', {
        shippingInfo: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '+380991112233',
          address: 'Kyiv, Main 1',
        },
        paymentMethod: 'cash_on_delivery',
        comment: '',
      });

      expect(connectionTransactionMock).toHaveBeenCalledTimes(1);
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'MongoDB transactions are unavailable; retrying checkout without a transaction. Configure MONGODB_URI to use MongoDB Atlas or a replica set for transactional checkout.',
      );
      expect(orderCreateMock).toHaveBeenCalledWith(
        [
          {
            userId: 'user-1',
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
            comment: '',
            status: 'pending',
          },
        ],
        {},
      );
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
        { updatePipeline: true },
      );
      expect(cartDoc.save).toHaveBeenCalledWith();
      expect(result.order.total).toBe(75);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      loggerWarnSpy.mockRestore();
    }
  });

  it('returns a delivery quote for the server-side cart', async () => {
    cartFindOneMock.mockReturnValue(
      leanResult({
        items: [
          {
            productId: 'product-1',
            quantity: 2,
          },
        ],
      }),
    );
    productFindMock.mockReturnValue(leanResult([product]));

    await expect(
      service.getDeliveryQuote('user-1', 'Kyiv, Main 1'),
    ).resolves.toEqual({
      subtotal: 25,
      deliveryFee: 50,
      additionalFee: 0,
      freeDeliveryThreshold: 500,
      amountToFreeDelivery: 475,
      message:
        'Delivery and extra fees are calculated based on shipping address',
    });
  });

  it('returns free delivery when the server-side cart reaches the free delivery threshold', async () => {
    cartFindOneMock.mockReturnValue(
      leanResult({
        items: [
          {
            productId: 'product-1',
            quantity: 40,
          },
        ],
      }),
    );
    productFindMock.mockReturnValue(leanResult([product]));

    await expect(
      service.getDeliveryQuote('user-1', 'Kyiv, Main 1'),
    ).resolves.toEqual({
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
