# Rebuild baseline architecture map

Date: 2026-11-12

This map records the intended module ownership and dependency direction. It is an architecture guardrail, not a domain specification. Canonical domain documents remain authoritative for business semantics.

## Ownership

| Location | Owner | Responsibility | May depend on |
| --- | --- | --- | --- |
| `product/src/domain/**` | Domain | Framework-independent entities, invariants, value rules | Domain and standard-library code only |
| `product/src/application/**` | Application | Use-case orchestration and application policies | Domain, ports, application-local types |
| `product/src/ports/**` | Ports | Inversion-of-control contracts and boundary DTOs | Domain and application-neutral types |
| `product/src/adapters/**` | Adapters | External input/output translation | Domain and ports; adapters do not define canonical semantics |
| `product/src/infra/**` | Infrastructure | Persistence, auth, telemetry, external services | Ports, domain types, infrastructure dependencies |
| `product/src/api/**` | API | HTTP controllers and transport validation | Application services, ports and domain types |
| `product/src/app.module.ts`, `main.ts`, `scripts/*.module.ts`, `scripts/migrate.ts` | Composition root | Nest bootstrap, provider wiring and migration command | Any layer, only at composition boundaries |

The pilot service and shared contracts now live under `application/` and `ports/`; PostgreSQL and in-memory implementations live under `infra/`; health delivery lives under `api/` and its readiness probe under `infra/`. The former production `modules/` and `health/` locations are no longer architecture-owned source locations. Co-located legacy test paths remain transitional and do not participate in production import enforcement.

## Rules

1. Domain must not import ports, API, infrastructure, application, adapters, NestJS, PostgreSQL, or other framework/runtime concerns.
2. Application must not import controllers, API, infrastructure, adapters, NestJS, PostgreSQL, or legacy modules.
3. Ports must remain framework-neutral and must not import implementation layers.
4. API must not import persistence, database clients, adapters, or controllers. API reaches behavior through application boundaries.
5. Adapters translate external records and may not own canonical commercial semantics or bypass domain factories/invariants.
6. Infrastructure is an implementation detail behind ports and is not an application entry point.
7. New files belong under one owned layer; composition-root files are explicit exceptions.
8. Tests are excluded from production import-graph enforcement because existing tests intentionally compose multiple layers.

## Checks

`product/scripts/check-architecture.mjs` is the dependency checker. It parses the TypeScript AST without executing application code, resolves relative and `@/` aliases, recognizes static/dynamic imports, `require`, and import types, and emits stable finding codes. Its behavior is covered by `product/scripts/check-architecture.test.mjs` and is a required CI gate.

- `ARCH-LOC-001`: source file is outside an owned layer.
- `ARCH-LOC-002`: source uses a legacy layer location.
- `ARCH-DEP-001`: forbidden internal layer dependency.
- `ARCH-DEP-002`: forbidden framework/database dependency.
- `ARCH-DEP-003`: internal dependency targets an unowned location or escapes the source root.
- `ARCH-API-001`: API imports a controller or bypasses the application boundary.

Use `npm run architecture:check` for a non-blocking report, `npm run test:architecture` for checker fixtures, and `npm run architecture:check:strict` to fail on any finding. CI requires the checker tests and strict check. Nest imports are allowed only in API/infrastructure and explicit composition roots; they remain forbidden in domain/application/ports/adapters. Composition exceptions are exact paths, not a blanket exemption for arbitrary files under `scripts/`.
