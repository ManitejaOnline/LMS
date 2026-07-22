# Zebl Corporate Training Portal

Internal enterprise HR onboarding / mandatory training portal (not a public course marketplace).

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20, Standalone, Signals, TailwindCSS, PrimeNG |
| Backend | NestJS, Fastify, Prisma |
| Database | PostgreSQL |
| Auth | JWT + RBAC (`SUPER_ADMIN` · `ADMIN` · `MANAGER` · `EMPLOYEE`) |
| Monorepo | npm workspaces |

## Quick start

### 1. Install

```bash
npm install
npm run build:shared
```

### 2. Configure PostgreSQL

Update `apps/api/.env` `DATABASE_URL`, then:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
```

Default seeded Super Admin:

- Email: `superadmin@zebl.local`
- Password: `ChangeMe!SuperAdmin1`

### 3. Run

```bash
npm run dev:api
npm run dev:web
```

- API: http://localhost:3000/api/v1  
- Swagger: http://localhost:3000/docs  
- Web: http://localhost:4200  

## Capabilities

Courses, modules, PDF/video player with tracking, quiz engine, assignments, role dashboards, reports/analytics, notifications, audit logs, dark mode.

## Workspaces

- `@zebl/api` → `apps/api`
- `@zebl/web` → `apps/web`
- `@zebl/shared` → `packages/shared`

## Documentation

- [Phase 5 gate](docs/phase-05/PHASE_GATE.md)
- [API (Phase 5)](docs/phase-05/API.md)
- [Security & production](docs/phase-05/SECURITY_AND_PRODUCTION.md)
- [Product Discovery](docs/phase-01/PRODUCT_DISCOVERY.md)
- [Coding Standards](docs/foundation/CODING_STANDARDS.md)
