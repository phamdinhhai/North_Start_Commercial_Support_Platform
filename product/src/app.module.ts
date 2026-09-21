import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';

/**
 * Root application module — PH1 walking skeleton shell.
 *
 * Chỉ wire các module shell (health + domain). KHÔNG có persistence,
 * KHÔNG có Pancake adapter, KHÔNG có AI inference (I-03, I-11, C-04 patch).
 *
 * Note: Forbidden paths (src/bernstein/**, templates/**, .agents/**) không
 * bao giờ được import ở đây.
 */
@Module({
  imports: [HealthModule],
})
export class AppModule {}
