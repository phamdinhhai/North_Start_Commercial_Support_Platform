# BOOT-001 — Bootstrap Revenue Continuity Domain Runtime

Status: APPROVED — Human Gate #1

> [!WARNING]
> **Artifact lịch sử — đã supersede (2026-10-27).** Story này mô tả **PH1 Walking Skeleton** và đã hoàn thành vai trò của nó tại commit `44ef6a1`. Các ràng buộc "persistence is deferred", "DO NOT implement: Lead semantics / Customer semantics / authentication / migrations", "`product/tests/**`", và "Human Gate #2" **không còn áp dụng**: từ PH2–PH3 dự án đã build domain entities, PostgreSQL migrations 001–004, auth/RBAC và pilot-loop, với test đặt cạnh source (`product/src/**/*.spec.ts`).
> **Nguồn chỉ đạo hiện hành:** `docs/implementation-plan/phases/PH1…PH6.md`, `docs/implementation-plan/state/progress.md`, `docs/implementation-plan/decisions/ADR-002-persistence.md`, `docs/reports/project-status-and-handover.md`.
> Giữ nguyên nội dung bên dưới để bảo toàn lịch sử quyết định (I-05). **Không sửa, không mở rộng, không dùng làm căn cứ cho PR mới.**

## Objective

Bootstrap the isolated executable product runtime for the Revenue Continuity
Platform.

This story establishes the application/framework shell only. It MUST NOT
implement Commercial Event or other commercial-domain semantics.

## Approved stack

- Node.js 22
- TypeScript
- NestJS
- Fastify adapter
- Vitest
- PostgreSQL is the future primary datastore target, but persistence is deferred.

## Product boundary

All product implementation MUST live under:

product/**

Existing repository tooling such as src/bernstein/** is not product code and
MUST remain unchanged.

The domain layer MUST remain framework independent.

The domain layer MUST NOT import:

- NestJS
- Fastify
- PostgreSQL drivers
- ORM/query builders
- Twenty
- Pancake
- external SDKs

## In scope

- product/package.json
- product/package-lock.json
- product/tsconfig.json
- product/vitest.config.ts
- product/nest-cli.json only if technically required
- product/src/domain/**
- product/src/application/**
- product/src/infrastructure/**
- product/src/adapters/http/**
- product/tests/**
- minimal NestJS + Fastify application shell
- minimal health/bootstrap behaviour
- automated verification
- npm scripts:
  - build
  - typecheck
  - test

## Required verification

From product/:

- npm ci
- npm run typecheck
- npm test
- npm run build

## Explicit non-goals

DO NOT implement:

- CommercialEvent semantics
- BUYER_COMMITMENT
- Customer semantics
- Lead semantics
- identity resolution
- attribution logic
- pricing logic
- PostgreSQL connection
- database schema
- ORM/query builder
- repositories
- migrations
- Redis
- queues
- event broker
- microservices
- Twenty integration
- Pancake integration
- external system mutation
- authentication
- frontend
- deployment
- production configuration
- production credentials

## Canonical references

Read only:

- docs/canonical/PRODUCT_CONSTITUTION.md
- docs/canonical/ARCHITECTURE_CONSTITUTION.md
- docs/canonical/DOMAIN_INVARIANTS.md
- docs/canonical/INTEGRATION_PRINCIPLES.md
- docs/canonical/OPEN_DECISIONS.md

## Open decisions that BOOT-001 MUST NOT resolve

- CE-1
- CE-2
- MM-1
- ID-1
- ID-2
- PM-1
- LG-1

## Role lifecycle

manager
→ backend
→ integration
→ qa
→ reviewer
→ Human Gate #2

Security is not part of BOOT-001 unless a concrete security-sensitive issue
is discovered.

## Acceptance criteria

1. Product runtime is isolated under product/**.
2. package-lock.json is committed.
3. NestJS uses the Fastify adapter.
4. Minimal bootstrap/health behaviour has automated verification.
5. npm ci succeeds.
6. npm run typecheck succeeds.
7. npm test succeeds.
8. npm run build succeeds.
9. Domain remains framework independent.
10. No persistence implementation exists.
11. No external integration exists.
12. No production credentials are introduced.
13. docs/canonical/** remains unchanged.
14. src/bernstein/** remains unchanged.
15. Delivery remains PR-based.
16. auto_merge remains false.
17. Human Gate #2 is required before merge.