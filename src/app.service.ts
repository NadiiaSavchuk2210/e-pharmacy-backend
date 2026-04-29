import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealthStatus() {
    return {
      name: 'e-pharmacy-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
