import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, Request, Response, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.disable('x-powered-by');
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.enableCors({
    origin: parseCorsOrigins(
      configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173',
    ),
    credentials: true,
  });
  app.enableShutdownHooks();
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
    .use((request: Request, response: Response) => {
      response.status(404).json({
        statusCode: 404,
        message: `Route ${request.method} ${request.originalUrl} not found`,
        error: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
        path: request.originalUrl,
      });
    });

  await app.listen(configService.getOrThrow<string>('PORT'));
}

function parseCorsOrigins(corsOrigin: string): string[] {
  return corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

void bootstrap();
