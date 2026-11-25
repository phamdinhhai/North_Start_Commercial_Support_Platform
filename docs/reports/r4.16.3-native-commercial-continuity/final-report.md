# R4.16.3 final engineering report

The origin/effective Lead authorization review found and fixed a real disclosure defect: explicit links previously authorized only the effective Lead. The projection now requires both immutable origin and effective Lead access for explicit links, while unlink/reject/no-link use origin authorization. PostgreSQL regression coverage passes 6/6.

The short React acceptance slice passes 1/1. A full browser journey extension was attempted and timed out during recipient-flow execution, so R4.16.3 remains `IMPLEMENTED_WITH_ACCEPTANCE_BLOCKERS`.
