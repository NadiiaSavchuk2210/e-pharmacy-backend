import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return backend health status', () => {
      const healthStatus = appController.getHello();
      const serviceHealthStatus = appService.getHealthStatus();

      expect(healthStatus.name).toBe('e-pharmacy-backend');
      expect(healthStatus.status).toBe('ok');
      expect(healthStatus.timestamp).toEqual(expect.any(String));
      expect(serviceHealthStatus.name).toBe('e-pharmacy-backend');
      expect(serviceHealthStatus.status).toBe('ok');
      expect(serviceHealthStatus.timestamp).toEqual(expect.any(String));
    });
  });
});
