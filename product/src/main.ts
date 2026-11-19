import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { JsonLogger } from './infra/observability/json-logger';
import { installContentDigester } from './ports/content-digester-runtime';
import { configuredContentDigester } from './infra/crypto/configured-content-digester';

async function bootstrap() {
  // ADR-009: deployment keys are required before accepting any commercial content.
  installContentDigester(configuredContentDigester(process.env));
  // Structured, allowlist-redacted JSON lines (LOG_LEVEL selects the threshold).
  const logger = new JsonLogger();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger },
  );

  app.enableShutdownHooks();
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/readiness', 'v1/health', 'v1/health/readiness'] });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`[NOSC] listening on :${port}`, 'Bootstrap');
}

bootstrap();
