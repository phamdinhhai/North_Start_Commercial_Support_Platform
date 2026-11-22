import { installContentDigester } from './src/ports/content-digester-runtime';
import { configuredContentDigester } from './src/infra/crypto/configured-content-digester';
// Explicit test harness binding. Every worker generates its own non-committed keys.
installContentDigester(configuredContentDigester({ NODE_ENV: 'test' }));
