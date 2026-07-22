# Architecture Decisions — Foundation

## AD-01: npm workspaces monorepo (not Nx)

**Decision:** Use native npm workspaces with `apps/*` and `packages/*`.  

**Why:** Lower toolchain weight for an early-stage enterprise app, explicit ownership of config, and enough isolation for Angular/Nest/shared contracts. Nx can be adopted later if generators/caching become a bottleneck.

## AD-02: NestJS + Fastify

**Decision:** NestJS application adapter is Fastify.  

**Why:** Better default throughput and lower overhead than Express for high-churn APIs (learning events later). Nest keeps modular structure and DI.

## AD-03: Prisma as the only data access layer

**Decision:** Prisma Client is the persistence abstraction; no raw SQL repositories in foundation.  

**Why:** Strong typing, migrations, and predictable schema evolution. Business models intentionally omitted until Database Design / domain phases.

## AD-04: Zod for boot-time env validation + Nest Config namespaces

**Decision:** Validate `process.env` with Zod; expose typed namespaces via `registerAs`.  

**Why:** Fail fast on misconfiguration; keep runtime config injectable and free of hardcoded values.

## AD-05: Pino structured logging

**Decision:** `nestjs-pino` with pretty transport only in non-prod.  

**Why:** JSON logs for production observability; redaction of auth headers by default; request ID propagation.

## AD-06: Global JWT auth guard + @Public opt-out (deny by default)

**Decision:** `JwtAuthGuard` is registered as `APP_GUARD`; public routes must opt in with `@Public()`.  

**Why:** Prevents accidental exposure of new endpoints. Foundation ships no login API yet; health endpoints are public.

## AD-07: RBAC via RolesGuard + shared AppRole enum

**Decision:** Role checks are declarative (`@Roles(...)`) and mirror `@zebl/shared` + Prisma `AppRole`.  

**Why:** Single source of role vocabulary across API/UI contracts; permission strings reserved for later fine-grained ACL.

## AD-08: Standard API envelope

**Decision:** Success responses are wrapped by `ResponseInterceptor`; errors by `GlobalExceptionFilter` into `{ success, data|error, timestamp, path, requestId }`.  

**Why:** Predictable client handling and audit-friendly correlation.

## AD-09: ValidationPipe whitelist + forbidNonWhitelisted

**Decision:** Global validation rejects unknown fields and strips non-DTO properties.  

**Why:** Mass-assignment protection and explicit API contracts.

## AD-10: Swagger behind config flag

**Decision:** OpenAPI enabled through `SWAGGER_ENABLED` / `SWAGGER_PATH`.  

**Why:** Useful in lower environments; can be disabled in hardened production if required.

## AD-11: Angular standalone + signals + PrimeNG Aura + Tailwind v4

**Decision:** No NgModules; signals for local UI state; PrimeNG for enterprise widgets; Tailwind for layout/spacing.  

**Why:** Aligns with Angular 20 defaults and avoids dual CSS-system sprawl (utility layout + component library).

## AD-12: Shared package for cross-cutting contracts

**Decision:** `@zebl/shared` holds roles, API envelope types, and JWT payload shapes.  

**Why:** Prevent drift between FE/BE contracts before OpenAPI codegen (optional later).

## AD-13: Foundation Prisma schema has only PrismaMeta + AppRole

**Decision:** No User/Course tables yet.  

**Why:** Enforce phase discipline — infrastructure without premature domain modeling.
