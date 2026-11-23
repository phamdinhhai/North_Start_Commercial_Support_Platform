import type { ContentDigester } from './content-digester';

let configured: ContentDigester | undefined;
/** Composition-root binding. Production must install a configured server keyring before intake. */
export function installContentDigester(digester: ContentDigester): void { configured = digester; }
export function contentDigester(): ContentDigester {
  if (!configured) throw new Error('content_digester_not_configured');
  return configured;
}
