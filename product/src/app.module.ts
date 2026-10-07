import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PilotLoopModule } from './api/pilot-loop.module';

/**
 * Root application module — PH1 walking skeleton shell + PH3 pilot loop wiring.
 *
 * Wire các module shell (health + pilot P0 loop). KHÔNG có Pancake adapter,
 * KHÔNG có AI inference (I-03, I-11, C-04 patch). Persistence pilot-loop hiện
 * in-memory; PG wiring là T3-05/T3-06 còn lại (xem state/progress.md 2026-10-07).
 *
 * Note: Forbidden paths (src/bernstein/**, templates/**, .agents/**) không
 * bao giờ được import ở đây.
 */
@Module({
  imports: [HealthModule, PilotLoopModule],
})
export class AppModule {}
