# North Start integration delta - R4.13.3

## Scope

This delta records the boundary between Pancake send forensics and the North Start
commercial domain. Evidence is limited to the existing sanitized capture and the
synthetic adapter test suite. No provider request, credential lookup, replay, merge,
or cleanup was performed while preparing this report.

## Classification

The observed send attempt remains `SEND_UNRESOLVED`. The Owner's manual verdict is
`NOT_OBSERVED`; it is not a provider assignment field. Provider assignment alone cannot establish
ownership, authorization, lead identity, or a commercial outcome. The integration
must retain the unresolved send as an append-only audit/evidence record and must not
infer delivery, read, conversion, revenue, or attribution.

## Adapter seam

The new offline transport/WAL boundary accepts fabricated fixtures only. Its
binding digest covers workspace, connection, operation, Page, conversation, and
exact payload bytes. It records categorical outcomes without persisting message
content. This code is not registered in the runtime, does not replace R4.12
source admission or RBAC, and does not activate provider transport or ingestion.
The existing synthetic sync, source identity, lease and checkpoint contracts
remain in force and are covered separately by regression.

The adapter emits observations only. It does not create or merge Customer and Lead
entities (I-01), alter a stable Lead ID (I-07), assign ownership, emit outcome or
revenue facts, or bypass the Commercial Event pipeline (I-04). AI remains draft-only
(I-03), and unknown values remain visible (I-08).

## Required follow-up

Resolve `SEND_UNRESOLVED` only through an owner-approved, provider-side manual review.
Until then, no second send, retry, tag/status/assignment mutation, provider request,
or inferred receipt is permitted. No canonical decision is changed by this work.
