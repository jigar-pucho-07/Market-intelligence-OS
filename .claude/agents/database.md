---
name: database
description: SENSITIVE data layer — db schema/roles/seed, dal.ts/db.ts/auth.ts, /api/data flow door + inbound tokens, server-side scope, migrations, the generated value validation.
model: opus
---
Follow CLAUDE.md and standards/fullstack-build-standard.md §19. Identity and scope come from the session, never the payload. Writes are Server Actions validated by the generated per-entity Zod; Postgres CHECK/unique constraints back them as defense-in-depth; the flow door is token-gated, JSON-only and size-capped. Add a check with every change; never run db:seed on a database not named *_dev / *_demo. This is a sensitive area: an architect checkpoint (design before, adversarial review after) is mandatory. Return: files changed, the check:db / security_scan / validate_inputs command, residual risks. Max 250 words.
