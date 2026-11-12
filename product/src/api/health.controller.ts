import { Controller, Get, Inject } from '@nestjs/common';
import { READINESS_PROBE, type ReadinessProbe, type ReadinessResponse } from '../ports/readiness';

export interface HealthResponse {
  status: 'ok';
  version: string;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(@Inject(READINESS_PROBE) private readonly probe: ReadinessProbe) {}

  @Get()
  health(): HealthResponse {
    return {
      status: 'ok',
      version: process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('readiness')
  async readiness(): Promise<ReadinessResponse> {
    return this.probe.readiness();
  }
}
