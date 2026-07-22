# Zebl Corporate Training Portal

Internal enterprise HR onboarding / mandatory training portal (not a public course marketplace).

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20, Standalone, Signals, TailwindCSS, PrimeNG |
| Backend | NestJS (Express), Prisma |
| Database | PostgreSQL |
| Auth | JWT + RBAC (`SUPER_ADMIN` · `ADMIN` · `MANAGER` · `EMPLOYEE`) |
| Monorepo | npm workspaces |

## Quick start (local)

```bash
npm install
npm run build:shared
docker compose up -d
# configure apps/api/.env then:
npm run prisma:generate
npm run prisma:migrate -w @zebl/api
npm run prisma:seed -w @zebl/api
npm run dev:api
npm run dev:web
```

- API: http://localhost:3000/api/v1  
- Swagger: http://localhost:3000/docs  
- Web: http://localhost:4200  

Default admin: `superadmin@zebl.local` / `ChangeMe!SuperAdmin1`

---

## Production on Vercel (frontend + backend)

Use **two Vercel projects** from the same GitHub repo. Vercel runs Nest as a [Fluid compute](https://vercel.com/docs/frameworks/backend/nestjs) function and the Angular app as static files.

```text
Browser → Vercel Web  (Angular SPA)
Browser → Vercel API  (NestJS) → Vercel Postgres / Neon
```

### 1. Database

In Vercel (or Neon): create **Postgres**, copy `DATABASE_URL` (prefer the **pooled** connection string).

Run migrations once from your machine:

```bash
cd apps/api
$env:DATABASE_URL="postgresql://..."
npx prisma migrate deploy
npx prisma db seed
```

### 2. API project

1. [vercel.com/new](https://vercel.com/new) → import this repo → name it e.g. `lms-api`
2. **Root Directory:** `apps/api`
3. Framework: NestJS (auto from [`apps/api/vercel.json`](apps/api/vercel.json))
4. Env vars from [`apps/api/.env.production.example`](apps/api/.env.production.example):
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (32+ random chars)
   - `APP_CORS_ORIGINS=https://YOUR-WEB-PROJECT.vercel.app`
5. Deploy. Confirm: `GET https://YOUR-API.vercel.app/api/v1/health/live`

### 3. Web project

1. New Vercel project → same repo → name e.g. `lms-web`
2. **Root Directory:** leave empty (repo root) — uses [`vercel.json`](vercel.json)
3. Set API origin in [`apps/web/src/environments/environment.prod.ts`](apps/web/src/environments/environment.prod.ts):

```ts
const API_ORIGIN = 'https://YOUR-API.vercel.app';
```

4. Commit, push, redeploy web.
5. Update API `APP_CORS_ORIGINS` to the web URL if it changed.

### Limits to know

- Uploads on Vercel go to ephemeral `/tmp` (not durable). For production media, plan S3/R2/Blob later.
- Platform request body size limits apply (large videos may fail on Hobby).
- Cold starts can make the first login after idle a bit slower.

### Optional: Railway instead of Vercel API

[`Dockerfile`](Dockerfile) + [`railway.toml`](railway.toml) remain supported if you prefer a long-running Node host for heavy uploads.

---

## Workspaces

- `@zebl/api` → `apps/api`
- `@zebl/web` → `apps/web`
- `@zebl/shared` → `packages/shared`
