import { Module } from '@nestjs/common';
import { PilotLoopController } from './pilot-loop.controller';
import { AuthService } from '../infra/auth/auth.service';
import { RbacService } from '../infra/rbac/rbac.service';
import { PilotLoopService } from '../modules/pilot-loop/pilot-loop.service';
import { ManualAdapter } from '../adapters/manual/manual-adapter';
import { AuditStore } from '../infra/audit/audit-store';

/**
 * P0 pilot loop module (PH3 T3-03/T3-04 wiring + education B2C candidate flow).
 * Persistence hiện tại in-memory (PilotLoopService + ManualAdapter + AuditStore);
 * PG-backed repository thay thế là phần T3-05/T3-06 wiring còn lại — chưa claim
 * [✓DB] cho module này.
 */
@Module({
  controllers: [PilotLoopController],
  providers: [AuthService, RbacService, PilotLoopService, ManualAdapter, AuditStore],
})
export class PilotLoopModule {}
