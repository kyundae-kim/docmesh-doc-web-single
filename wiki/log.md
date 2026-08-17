# Wiki Log

> Chronological record of all wiki actions. Append-only.
> Format: `## [YYYY-MM-DD] action | subject`
> Actions: ingest, update, query, lint, create, archive, delete
> When this file exceeds 500 entries, rotate it to `log-YYYY.md` and start fresh.

## [2026-08-17] create | Wiki initialized
- Domain: document-management web project frontend.
- Scope: web UI, frontend architecture, UX, and consumption of an external RESTful API.
- Structure created: `SCHEMA.md`, `index.md`, `log.md`, `raw/articles/`, `raw/papers/`, `raw/transcripts/`, `raw/assets/`, `entities/`, `concepts/`, `comparisons/`, `queries/`.
- Content pages: none yet.

## [2026-08-17] ingest | DocMesh Document Service Wiki v0.5.0
- Sources ingested:
  - `https://github.com/kyundae-kim/docmesh-doc/wiki/API-Reference-v0.5.0`
  - `https://github.com/kyundae-kim/docmesh-doc/wiki/Configuration-v0.5.0`
  - `https://github.com/kyundae-kim/docmesh-doc/wiki/Examples-v0.5.0`
- Raw source files created:
  - `raw/articles/docmesh-api-reference-v0-5-0.md`
  - `raw/articles/docmesh-configuration-v0-5-0.md`
  - `raw/articles/docmesh-examples-v0-5-0.md`
- Wiki pages created:
  - `entities/docmesh-document-service.md`
  - `concepts/api-reference-v0-5-0.md`
  - `concepts/configuration-v0-5-0.md`
  - `concepts/examples-v0-5-0.md`
- Navigation updated: `index.md`
- This log updated: `log.md`
- All new pages cross-reference the central service and the related API/configuration/examples pages.
