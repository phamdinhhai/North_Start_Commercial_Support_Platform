/** ADR-007: never admit real provider traffic by enabling a fabricated fixture surface. */
export function syntheticSourceMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.SOURCE_INTEGRATION_SYNTHETIC_ENABLED ?? '';
  if (value === '' || value === 'false') return false;
  if (value !== 'true' || !['local', 'test'].includes(env.DEPLOYMENT_MODE ?? '') ||
      env.NODE_ENV === 'production' || env.AUTH_MODE !== 'oidc' || env.PILOT_STORE_MODE !== 'postgres') {
    throw new Error('SOURCE_SYNTHETIC_CONFIGURATION_INVALID');
  }
  return true;
}
