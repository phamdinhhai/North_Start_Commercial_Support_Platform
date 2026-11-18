import { describe, it, expect, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationIntake } from '../application/integration/intake';
import { IntegrationError } from '../ports/integration';
import type { AuthContextResolver } from '../ports/auth';
const setup = () => {
    const intake = { enroll: vi.fn(), append: vi.fn(), revoke: vi.fn(), enrollAsPrincipal: vi.fn(), revokeAsPrincipal: vi.fn() } as unknown as IntegrationIntake;
    const auth = { resolve: vi.fn().mockReturnValue({ workspaceId: 'w', userId: 'u', role: 'manager', isDemo: false }) } satisfies AuthContextResolver;
    return { intake, auth, controller: new IntegrationController(intake, auth) };
};
describe('integration response boundary', () => {
    it('maps typed failures and redacts unexpected database errors', async () => {
        const { intake, controller } = setup();
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
    it('resolves the principal from headers only and never from the body', async () => {
        const { intake, auth, controller } = setup();
        vi.mocked(intake.enrollAsPrincipal).mockResolvedValue({} as never);
        const body = { workspaceId: 'attacker', authorization: 'Bearer forged' };
        await controller.enrollAsPrincipal({ authorization: 'Bearer app' }, body);
        expect(auth.resolve).toHaveBeenCalledWith({ headers: { authorization: 'Bearer app' } });
        expect(intake.enrollAsPrincipal).toHaveBeenCalledWith({ workspaceId: 'w', userId: 'u', role: 'manager', isDemo: false }, body);
        auth.resolve.mockReturnValue(null);
        vi.mocked(intake.revokeAsPrincipal).mockRejectedValue(new IntegrationError('UNAUTHORIZED', 401));
        await expect(controller.revokeAsPrincipal({}, { enrollmentId: 'x' })).rejects.toMatchObject({ status: 401 });
        expect(intake.revokeAsPrincipal).toHaveBeenCalledWith(null, { enrollmentId: 'x' });
    });
    it('redacts resolver failures as unavailable without leaking detail', async () => {
        const { auth, controller } = setup();
        auth.resolve.mockImplementation(() => { throw new Error('idp secret detail'); });
        await expect(controller.enrollAsPrincipal({}, {})).rejects.toMatchObject({ status: 503, response: { code: 'INTAKE_UNAVAILABLE' } });
    });
});
