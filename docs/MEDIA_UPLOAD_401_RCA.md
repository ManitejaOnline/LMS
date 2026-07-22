# Media Upload 401 — Root Cause Analysis & Fix

**Date:** 15 July 2026  
**Endpoint:** `POST /api/v1/media/upload`  
**Reported error:** `401 UNAUTHORIZED` — `Authentication required`

---

## Investigation summary (evidence-based)

### Upload path actually used

| Step | File | Finding |
|---|---|---|
| UI | `apps/web/src/app/shared/components/upload-dialog/upload-dialog.component.ts` | Native `<input type="file">` + button; **not** PrimeNG `FileUpload` |
| API client | `apps/web/src/app/core/http/courses-api.service.ts` → `uploadMedia()` | Angular `HttpClient.post` + `FormData` |
| Interceptor | `apps/web/src/app/core/interceptors/auth.interceptor.ts` | Registered in `app.config.ts` via `withInterceptors` |
| Token store | `apps/web/src/app/core/auth/token-storage.service.ts` | `localStorage` keys `zebl.accessToken` / `zebl.refreshToken`; set on login |
| Guard | Global `JwtAuthGuard` + `@Roles(SUPER_ADMIN, ADMIN)` on `MediaController` | Correct; not `@Public` |

**PrimeNG FileUpload is not used.** Upload does **not** bypass HttpClient. XHR/fetch wrappers are not used for media upload.

### Exact code path

```
UploadDialogComponent.upload()
  → CoursesApiService.uploadMedia(kind, file)
    → HttpClient.post(FormData → /api/v1/media/upload)
      → authInterceptor (Bearer access token when present)
        → Nest JwtAuthGuard + JwtStrategy
          → MediaController.upload()
```

### Server log evidence (Chrome from `localhost:4200`)

1. **`req-u` (22:50:17)** — JWT **passed**. Controller ran. Response **400**:
   - `kind is required and must be one of: THUMBNAIL, DOCUMENT, VIDEO`
   - Proof that Authorization + JwtStrategy worked for that request.

2. **`req-v`+ (22:51:31)** — Same-size retry. Stack:
   - `passport-jwt` → `jsonwebtoken/verify.js` → `strategy.fail`
   - Not “No auth token” (that fails earlier at extractor). Token was present but **verification failed** (typically **expired** access JWT).
   - Access TTL is **15m** (`JWT_ACCESS_EXPIRES_IN`). No refresh-on-401 existed, so long authoring sessions made upload fail with generic `Authentication required`.

3. Successful GETs (`/users`, `/courses/:id`) earlier prove interceptor + storage work for non-multipart traffic. `authorization` is **redacted** in Pino logs (`app.module.ts`), so absence of the header in logs is **not** evidence it was missing.

### Why Fastify returned 400 on `kind` when auth worked

Client originally built FormData as:

```ts
form.append('file', file);
form.append('kind', kind); // AFTER file
```

`MediaController` used `await request.file()` then `raw.fields?.kind`. With `@fastify/multipart`, fields that appear **after** the file part are often **not** on `file.fields` yet → `kind` undefined → 400.

That is separate from 401 but was the first failure mode on a valid session.

### Ruled out

| Hypothesis | Verdict |
|---|---|
| Upload bypasses HttpClient / PrimeNG FileUpload | **False** — native file input + HttpClient |
| Interceptor excludes `/media/upload` | **False** — no URL exclusion except we added only for auth bootstrap URLs when refreshing |
| Media route is `@Public` | **False** |
| CORS stripping Authorization | Unlikely — request reaches API; OPTIONS for `authorization` returns 204; first upload authenticated |
| JwtStrategy never works on Fastify | **False** — GETs and first upload authenticated |

---

## Root cause (two cooperating defects)

1. **401:** Access JWT expired during the course-authoring session; browser still sent the old Bearer token; `JwtStrategy` failed verification; no silent refresh/retry existed → `UnauthorizedException('Authentication required')`.

2. **Related upload failure:** FormData field order (`file` before `kind`) + `request.file()` field binding → **400** when the token was still valid (logged as `req-u`).

---

## Affected files

| File | Change |
|---|---|
| `apps/web/src/app/core/http/courses-api.service.ts` | Append `kind` **before** `file` |
| `apps/web/src/app/core/interceptors/auth.interceptor.ts` | On 401: single-flight refresh + retry (skip login/refresh URLs) |
| `apps/api/src/modules/media/media.controller.ts` | Parse all multipart `parts()` so `kind`/`file` order does not matter |
| `apps/api/src/infrastructure/auth/guards/jwt-auth.guard.ts` | Surface JWT info message (e.g. `jwt expired`) instead of opaque text |

---

## Recommended / implemented fix

1. Client: `kind` then `file` in FormData.  
2. Server: consume `request.parts()` for kind + file.  
3. Client: refresh access token once on 401 and retry the upload (and any other authenticated call).  
4. Guard: clearer expired-token messages for future diagnosis.

Restart API after pull so controller/guard changes load. Hard-refresh the web app so the new interceptor and FormData order are used.
