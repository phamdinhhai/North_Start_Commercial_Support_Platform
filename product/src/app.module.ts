import { Module } from '@nestjs/common';
import { HealthModule } from './scripts/health.module';
import { PilotLoopModule } from './scripts/pilot-loop.module';

/** Composition root for the manual pilot loop and health delivery. */
@Module({
  imports: [HealthModule, PilotLoopModule],
})
export class AppModule {}
