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

## Quick start (local)

### 1. Install

```bash
npm install
npm run build:shared
```

### 2. Configure PostgreSQL

```bash
docker compose up -d
```

Update `apps/api/.env` `DATABASE_URL`, then:

```bash
npm run prisma:generate
npm run prisma:migrate -w @zebl/api
npm run prisma:seed -w @zebl/api
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

---

## Production deploy

Vercel hosts the **frontend only**. The NestJS API must run on a long-lived Node host (Railway recommended). Postgres can be Railway Postgres, Neon, or Vercel Postgres — the API reads `DATABASE_URL`.

```text
Browser  →  Vercel (Angular SPA)
Browser  →  Railway (Nest API)  →  Postgres
```

### A. Deploy API on Railway

1. Create a project at [railway.app](https://railway.app) and connect this GitHub repo.
2. Add a **PostgreSQL** plugin; copy its `DATABASE_URL` into the API service.
3. Create a service from the repo root (uses [`Dockerfile`](Dockerfile) + [`railway.toml`](railway.toml)).
4. Set variables from [`apps/api/.env.production.example`](apps/api/.env.production.example), especially:
   - `DATABASE_URL` (from Postgres plugin)
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (long random strings, 32+ chars)
   - `APP_CORS_ORIGINS=https://lms-api-ten.vercel.app` (your Vercel URL; comma-separate extras)
5. Deploy. Note the public API URL, e.g. `https://zebl-lms-api.up.railway.app`.
6. Confirm health: `GET https://YOUR-API-HOST/api/v1/health/live`
7. Seed once (Railway shell or locally against prod DB):

```bash
cd apps/api
DATABASE_URL="postgresql://..." npx prisma db seed
```

### B. Point the web app at the API

Edit [`apps/web/src/environments/environment.prod.ts`](apps/web/src/environments/environment.prod.ts):

```ts
const API_ORIGIN = 'https://YOUR-API-HOST'; // Railway public URL, no trailing slash
```

Commit and push so Vercel rebuilds.

### C. Deploy frontend on Vercel

1. Import the same GitHub repo in Vercel.
2. **Root Directory**: leave empty (repo root) — do **not** use `apps/api`.
3. Build settings come from root [`vercel.json`](vercel.json) (builds `@zebl/shared` + `@zebl/web` only).
4. Deploy. Login should POST to `https://YOUR-API-HOST/api/v1/auth/login`.

### Why not “everything on Vercel”?

This API uses NestJS + Fastify, Prisma, disk uploads, and long learning timers. Vercel serverless is not a drop-in host for that stack. Hosting the SPA on Vercel and POSTing to the same origin without a Nest server produces **405** (static HTML rewrite).

---

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
