# Zebl India LMS — Publish Guide

Hand-off for whoever is publishing or moving this app to another host.

## 1. Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20 (standalone + signals), TailwindCSS, PrimeNG |
| Backend | NestJS (Express), Zod, Swagger |
| ORM / DB | Prisma + PostgreSQL |
| Auth | JWT + RBAC (`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `EMPLOYEE`) |
| Media | Vercel Blob (videos upload direct to Blob) |
| Monorepo | npm workspaces (`apps/web`, `apps/api`, `packages/shared`) |

**Repo:** https://github.com/ManitejaOnline/LMS.git  
**Branch for production:** `main`

---

## 2. Current production (live)

Today the app is published on **Vercel** (not AWS yet).

| App | URL | Vercel project setup |
|---|---|---|
| Web | https://lms-zebl.vercel.app | Repo root — uses root `vercel.json` |
| API | https://zebl-lms.vercel.app | Root Directory = `apps/api` |

Web → API wiring is in:

`apps/web/src/environments/environment.prod.ts`

```ts
const API_ORIGIN = 'https://zebl-lms.vercel.app';
```

Health check:

```http
GET https://zebl-lms.vercel.app/api/v1/health/live
```

---

## 3. How to publish (Vercel)

1. Merge / push to `main`.
2. Vercel auto-deploys **both** the web and API projects.
3. Confirm API health (URL above).
4. Hard-refresh the web app after deploy finishes.

Redeploy either project manually from the Vercel dashboard if needed.

### After changing domains

1. Update `APP_CORS_ORIGINS` on the API project to the new web URL(s), comma-separated.
2. Update `API_ORIGIN` in `environment.prod.ts` and redeploy web.

---

## 4. Required API environment variables

Copy from `apps/api/.env.production.example` into the **Vercel API project** → Settings → Environment Variables.

Critical values:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres (prefer pooled URL + `sslmode=require`) |
| `JWT_ACCESS_SECRET` | Access token secret (32+ random chars) |
| `JWT_REFRESH_SECRET` | Refresh token secret (32+ random chars) |
| `APP_CORS_ORIGINS` | e.g. `https://lms-zebl.vercel.app` |
| `BLOB_READ_WRITE_TOKEN` and/or `BLOB_STORE_ID` | Vercel Blob for durable media |
| `UPLOAD_MAX_VIDEO_BYTES` | Default `500000000` (500 MB) |
| `NODE_ENV` | `production` |
| `LOG_PRETTY` | `false` |
| `SWAGGER_ENABLED` | Prefer `false` in production |

### Database migrations (run once / on schema change)

From a machine that can reach production Postgres:

```bash
cd apps/api
# set DATABASE_URL to the production connection string
npx prisma migrate deploy
npx prisma db seed
```

Default seed admin (change in production):

- Email: `superadmin@zebl.local`
- Password: `ChangeMe!SuperAdmin1`

---

## 5. Media / video upload notes

Vercel serverless request bodies are capped (~4.5 MB). Large videos must not go through Nest multipart.

Production flow:

1. `POST /api/v1/media/upload-plan` — validates file, returns direct Blob upload URL when needed  
2. Browser uploads file **directly to Vercel Blob**  
3. `POST /api/v1/media/upload-complete` — registers `MediaAsset` after Blob verify  

Small PDFs / thumbnails can still use `POST /api/v1/media/upload`.

Blob must be connected on the API project (Storage → Blob). OIDC (`BLOB_STORE_ID`) or `BLOB_READ_WRITE_TOKEN` is required for direct video uploads.

---

## 6. Recent product behavior to know

- **Course outline:** video lessons are unlocked (no sequential lock). PDF lessons still follow sequential unlock + page timer rules.
- **Program level page:** shows Day 1…N course cards and nested lesson/video lists.
- **Learning programs:** employee flow is Program → Levels → Courses → Player.

---

## 7. Local development

```bash
npm install
npm run build:shared
docker compose up -d          # Postgres on localhost:5433
# configure apps/api/.env
npm run prisma:generate
npm run prisma:migrate -w @zebl/api
npm run prisma:seed -w @zebl/api
npm run dev:api               # http://localhost:3000/api/v1
npm run dev:web               # http://localhost:4200
```

Swagger (local): http://localhost:3000/docs

---

## 8. Publishing on AWS (not configured yet)

If moving off Vercel, a typical AWS layout is:

| Piece | AWS service |
|---|---|
| Angular SPA | S3 + CloudFront |
| NestJS API | ECS/Fargate, App Runner, or Elastic Beanstalk |
| PostgreSQL | RDS PostgreSQL |
| Media files | S3 (replace `@vercel/blob`) |
| DNS / TLS | Route 53 + ACM |

Also required on AWS:

- New CI/CD (GitHub Actions → ECR/ECS, or similar)
- Rewrite media upload to S3 (presigned PUT), not Vercel Blob
- Update CORS + `environment.prod.ts` to the new API domain
- Run Prisma migrations against RDS

A `Dockerfile` exists at the repo root for containerized API hosting. There is **no** full AWS IaC / pipeline in this repo yet.

---

## 9. Workspaces quick map

| Package | Path |
|---|---|
| `@zebl/web` | `apps/web` |
| `@zebl/api` | `apps/api` |
| `@zebl/shared` | `packages/shared` |

---

## 10. Checklist before calling it live

- [ ] `main` pushed and both Vercel projects green  
- [ ] `GET /api/v1/health/live` returns OK  
- [ ] Login works against production DB  
- [ ] `APP_CORS_ORIGINS` matches the live web URL  
- [ ] Blob store connected; video upload works end-to-end  
- [ ] Seed admin password changed  
- [ ] Swagger disabled (or protected) in production  
- [ ] Hard-refresh / cache-bust after web deploy  

For high-level product README, see [`README.md`](../README.md).
