import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  version: string;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  @Get()
  health(): HealthResponse {
    return {
      status: 'ok',
      version: process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
