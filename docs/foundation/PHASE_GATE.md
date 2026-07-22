# Phase Gate — Foundation (Technical Phase 1)

**Status:** Complete — awaiting approval  

## Folder Structure

```text
Zebl_LMS/
├── apps/
│   ├── api/                      # NestJS + Fastify API
│   │   ├── prisma/               # Prisma schema (foundation only)
│   │   └── src/
│   │       ├── config/           # Env + typed config modules
│   │       ├── common/           # Filters, interceptors, decorators
│   │       ├── infrastructure/   # Prisma, JWT/RBAC infra
│   │       └── modules/health/   # Health checks only
│   └── web/                      # Angular 20 SPA
│       └── src/app/
│           ├── core/             # Auth storage, HTTP, interceptors
│           ├── shared/           # Reusable UI + utils
│           ├── layout/           # Shell layout
│           └── features/         # Foundation/home screens only
├── packages/
│   └── shared/                   # Shared contracts (roles, API envelope, JWT payload)
├── docs/
├── docker-compose.yml            # Local PostgreSQL
└── package.json                  # npm workspaces root
```

## Deliverables checklist

- [x] Monorepo (npm workspaces)
- [x] Angular 20 project (standalone, signals, Tailwind, PrimeNG)
- [x] NestJS + Fastify project
- [x] Prisma + PostgreSQL configuration
- [x] Environment configuration (Zod-validated)
- [x] JWT infrastructure (strategy, token service, guard)
- [x] RBAC infrastructure (`@Roles`, `RolesGuard`)
- [x] Logging (Pino)
- [x] Global exception filter
- [x] ValidationPipe
- [x] Swagger
- [x] Shared components + utilities
- [x] API response standard
- [x] Health check
- [x] Coding standards document

## Explicitly excluded (correct)

Users, Courses, Lessons, Assignments, Progress, Quiz, Reports, Login/Logout endpoints.
