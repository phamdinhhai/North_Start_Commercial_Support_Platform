import { describe, it, expect, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationIntake } from '../application/integration/intake';
import { IntegrationError } from '../ports/integration';
describe('integration response boundary', () => {
    it('maps typed failures and redacts unexpected database errors', async () => {
        const intake = { enroll: vi.fn(), append: vi.fn(), revoke: vi.fn() } as unknown as IntegrationIntake;
        const controller = new IntegrationController(intake);
        vi.mocked(intake.enroll).mockRejectedValue(new IntegrationError('UNAUTHORIZED', 401));
        await expect(controller.enroll('bad', {})).rejects.toMatchObject({ status: 401 });
        vi.mocked(intake.append).mockRejectedValue(new Error('private database credential'));
        try {
            await controller.append('Bearer secret', {});
            throw new Error('expected rejection');
        }
        catch (error) {
            expect(error).toBeInstanceOf(HttpException);
            expect((error as HttpException).getResponse()).toEqual({ code: 'INTAKE_UNAVAILABLE' });
        }
    });
});
