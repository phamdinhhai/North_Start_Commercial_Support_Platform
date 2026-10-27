# North_Start_Commercial_Support_Platform

> Revenue Continuity Platform — Turn every customer conversation into a measurable commercial journey

## Overview

Revenue Operating System layer giữa Ad platforms, Pancake và CRM. Bảo toàn commercial meaning từ acquisition qua conversation, lead, handoff, Sales action, outcome, revenue và attribution.

- **Long-Term North Star (`LG-1`):** Multi-platform commercial continuity across acquisition, conversation, lead, handoff, Sales action, outcome, revenue, and attribution (`docs/canonical/PRODUCT_NORTH_STAR.md`).
- **Current P0 LVP Scope (`ADR-004`):** Single-tenant manual/synthetic education B2C pilot loop (`ingest → handoff → accept → work item → outcome → append-only audit`) backed by PostgreSQL 16 (`product/`). Pancake read-sync (PH4, flagged OFF) and AI draft extraction remain deferred to P1/post-L3.

## Quick Links

| Document | Location |
|----------|----------|
| Project Status & Handover | [docs/reports/project-status-and-handover.md](docs/reports/project-status-and-handover.md) |
| Problem Framing V2 | [docs/Dinh_nghia_bai_toan_V2.md](docs/Dinh_nghia_bai_toan_V2.md) |
| Implementation Plan | [docs/implementation-plan/00-README.md](docs/implementation-plan/00-README.md) |
| Canonical Sources | [docs/canonical/README.md](docs/canonical/README.md) |
| Requirements | [docs/implementation-plan/03-requirements.md](docs/implementation-plan/03-requirements.md) |
| Architecture | [docs/implementation-plan/04-architecture.md](docs/implementation-plan/04-architecture.md) |
| Phase Map | [docs/implementation-plan/05-phase-map.md](docs/implementation-plan/05-phase-map.md) |
| Agent Rules | [AGENTS.md](AGENTS.md) |

## Build & Verify

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
| 1 | `docs/canonical/` | Normative product truth (frozen) |
| 2 | `docs/north-star/`, `docs/architecture/` | Strategic + integration architecture |
| 3 | `docs/delivery/` | Stories, contracts |
| 4 | `docs/research/` | Research supplements |
| 5 | `docs/_archive/` | Legacy (superseded) |
| 6 | `AGENTS.md`, `docs/config/` | Build/test/agent configuration |
