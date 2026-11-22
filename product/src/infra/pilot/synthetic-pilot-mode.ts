import { resolveDeploymentMode } from '../postgres/postgres.service';

/** Admission mode is fixed at bootstrap, never a caller-controlled classification override. */
export function syntheticPilotOnly(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.SYNTHETIC_PILOT_ONLY ?? '';
  if (!['', 'false', 'true'].includes(value)) throw new Error('INVALID_SYNTHETIC_PILOT_ONLY');
  if (value !== 'true') return false;
  if (env.NODE_ENV === 'production' || !['local', 'test'].includes(resolveDeploymentMode(env)) || env.AUTH_MODE !== 'oidc') {
    throw new Error('SYNTHETIC_PILOT_REQUIRES_LOCAL_OIDC');
  }
  return true;
}
