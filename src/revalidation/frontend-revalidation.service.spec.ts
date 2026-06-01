import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FrontendRevalidationService } from './frontend-revalidation.service';

describe('FrontendRevalidationService', () => {
  let service: FrontendRevalidationService;
  let configGetMock: jest.Mock;
  let fetchMock: jest.Mock;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn(),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    configGetMock = jest.fn((key: string) => {
      const config: Record<string, string> = {
        FRONTEND_URL: 'https://frontend.example.com',
        REVALIDATE_SECRET: 'secret-value',
      };

      return config[key];
    });

    service = new FrontendRevalidationService({
      get: configGetMock,
    } as unknown as ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('posts revalidation events with the shared secret header', async () => {
    await service.notify({
      type: 'product-review.created',
      productId: 'product-001',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://frontend.example.com/api/revalidate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': 'secret-value',
        },
        body: JSON.stringify({
          type: 'product-review.created',
          productId: 'product-001',
        }),
      },
    );
  });

  it('skips notification when frontend revalidation is not configured', async () => {
    configGetMock.mockReturnValue(undefined);

    await service.notify({ type: 'product.created' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs failed frontend responses without throwing', async () => {
    const loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();

    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('try again later'),
    });

    await expect(
      service.notify({ type: 'store.deleted', id: 'store-001' }),
    ).resolves.toBeUndefined();

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Frontend revalidation failed for store.deleted: 500 try again later',
    );
  });
});
