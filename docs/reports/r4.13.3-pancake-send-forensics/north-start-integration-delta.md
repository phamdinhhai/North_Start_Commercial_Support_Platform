# North Start integration delta - R4.13.3

## Scope

This delta records the boundary between Pancake send forensics and the North Start
commercial domain. Evidence is limited to the existing sanitized capture and the
synthetic adapter test suite. No provider request, credential lookup, replay, merge,
or cleanup was performed while preparing this report.

## Classification

The observed send attempt remains `SEND_UNRESOLVED`. `CurrentOwner` is
`NOT_OBSERVED`; therefore assignment is an observation only and cannot establish
ownership, authorization, lead identity, or a commercial outcome. The integration
must retain the unresolved send as an append-only audit/evidence record and must not
infer delivery, read, conversion, revenue, or attribution.

## Adapter seam

The offline transport/WAL boundary accepts synthetic envelopes and produces typed
receipts. Raw request and response bytes remain immutable and HMAC/hash metadata is
retained before projection. Workspace, connection, account/Page, conversation, and
lead-scoped RBAC checks are enforced at the boundary. Duplicate external IDs are
idempotent; changed payloads are quarantined; cursor gaps, lease loss, revoked
enrollment, malformed pages, and scope mismatch fail closed.

The adapter emits observations only. It does not create or merge Customer and Lead
entities (I-01), alter a stable Lead ID (I-07), assign ownership, emit outcome or
revenue facts, or bypass the Commercial Event pipeline (I-04). AI remains draft-only
(I-03), and unknown values remain visible (I-08).

## Required follow-up

Resolve `SEND_UNRESOLVED` only through an owner-approved, provider-side manual review.
Until then, no second send, retry, tag/status/assignment mutation, or inferred
receipt is permitted. CE-1, CE-2, MM-1, ID-1, ID-2, PM-1, and LG-1 remain open.
