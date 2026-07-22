# Coding Standards — Zebl Corporate Training Portal

## General

- Prefer composition over inheritance.
- Keep business logic out of controllers / components.
- Feature-based modules; no cross-feature deep imports.
- No hardcoded secrets, URLs, timeouts, or business constants — use configuration.
- Every public API returns the shared `ApiResponse` envelope.
- Deny-by-default authorization (`JwtAuthGuard` + optional `Roles`).

## Backend (NestJS)

- Controllers: HTTP mapping only.
- Services: orchestration and application rules.
- Infrastructure: Prisma, JWT, external adapters.
- DTOs validated with `class-validator`.
- Env validated with Zod at boot.
- Logging via `nestjs-pino` (structured JSON in production).
- Throw `HttpException` (or domain-mapped exceptions); never leak stack traces.
- Prefer Fastify request/response types in filters/interceptors.

## Frontend (Angular)

- Standalone components only.
- Prefer signals for local UI state.
- Use `HttpClient` functional interceptors.
- Shared presentational components live in `shared/`.
- Feature pages live in `features/`.
- Core services (auth storage, API client, health) live in `core/`.
- No business feature modules in Foundation phase.

## Naming

| Layer | Convention |
|---|---|
| Files | `kebab-case` |
| Classes | `PascalCase` |
| Methods / fields | `camelCase` |
| Constants | `SCREAMING_SNAKE_CASE` or `const` objects |
| DB tables/columns | `snake_case` via Prisma `@@map` / `@map` |
| API routes | `kebab-case` resource nouns |

## Testing expectations (foundation+)

- Unit tests for guards, filters, utils.
- Integration/e2e for health and auth once Auth module exists.
- Modules must remain independently testable.
