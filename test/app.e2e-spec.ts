import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

@Controller()
class TestAppController {
  @Get()
  getHealthStatus() {
    return {
      name: 'e-pharmacy-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App> & NestExpressApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestAppController],
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
    app
      .getHttpAdapter()
      .getInstance()
      .use((req: Request, res: Response) => {
        res.status(404).json({
          statusCode: 404,
          message: `Route ${req.method} ${req.originalUrl} not found`,
          error: 'NOT_FOUND',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
      });
  });

  it('/api (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(200);
        expect(body.message).toBe('Request completed successfully');
        expect(body.data.name).toBe('e-pharmacy-backend');
        expect(body.data.status).toBe('ok');
        expect(body.data.timestamp).toEqual(expect.any(String));
      });
  });

  it('returns a formatted 404 response for unknown routes', () => {
    return request(app.getHttpServer())
      .get('/api/missing-route')
      .expect(404)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(404);
        expect(body.message).toBe('Route GET /api/missing-route not found');
        expect(body.error).toBe('NOT_FOUND');
        expect(body.timestamp).toEqual(expect.any(String));
        expect(body.path).toBe('/api/missing-route');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
