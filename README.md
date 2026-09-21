# North_Start_Commercial_Support_Platform

> Revenue Continuity Platform — Turn every customer conversation into a measurable commercial journey

## Overview

Revenue Operating System layer giữa Ad platforms, Pancake và CRM. Bảo toàn commercial meaning từ acquisition qua conversation, lead, handoff, Sales action, outcome, revenue và attribution.

## Quick Links

| Document | Location |
|----------|----------|
| Implementation Plan | [docs/implementation-plan/00-README.md](docs/implementation-plan/00-README.md) |
| Canonical Sources | [docs/canonical/README.md](docs/canonical/README.md) |
| Requirements | [docs/implementation-plan/03-requirements.md](docs/implementation-plan/03-requirements.md) |
| Architecture | [docs/implementation-plan/04-architecture.md](docs/implementation-plan/04-architecture.md) |
| Phase Map | [docs/implementation-plan/05-phase-map.md](docs/implementation-plan/05-phase-map.md) |
| Agent Rules | [AGENTS.md](AGENTS.md) |

## Build (sau PH1)

```bash
cd product/
npm ci
npm run typecheck
npm test
npm run build
```

## Documentation Hierarchy

| Tier | Path | Description |
|------|------|-------------|
| 1 | `docs/canonical/` | Normative product truth |
| 2 | `docs/north-star/`, `docs/architecture/` | Strategic architecture |
| 3 | `docs/delivery/` | Stories, contracts |
| 4 | `docs/research/` | Research supplements |
| 5 | `docs/_archive/` | Legacy (superseded) |
