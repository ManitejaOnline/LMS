# Security Review — Phase 5

## Controls in place

- JWT access tokens; refresh tokens hashed and rotated.
- Global auth guard; `@Public` only for login/health/forgot-password paths.
- RBAC via `@Roles` — quiz bank admin-only; reports scoped by role; learners can only attempt their assignments.
- Soft deletes on domain entities.
- Audit log on sensitive mutations (quiz upsert, submit, assignments).
- ValidationPipe whitelist + class-validator DTOs.
- Password hashing (bcrypt); change/reset flows.

## Residual risks (acceptable for MVP → harden in ops)

| Risk | Mitigation path |
|---|---|
| Local filesystem media | Move to object storage + signed URLs |
| No rate limiting on login/quiz submit | Add gateway / Nest throttler |
| Swagger enabled in non-prod | Disable or protect in production `NODE_ENV` |
| CSRF N/A for bearer SPA | Keep tokens out of localStorage long-term → prefer httpOnly cookies if threat model requires |
| PDF.js in browser | Serve media only to authenticated users (already gated by learning APIs) |

## Accessibility notes

- Skip-to-content link on app shell.
- `:focus-visible` outlines on interactive elements.
- Theme toggle and notification bell labeled.
- Reports tabs use `role="tab"` / `aria-selected`.

## Performance notes

- Reports use groupBy / capped queries (`take`).
- Angular lazy routes for feature pages.
- Learning events batched where tracker already coalesces.

## Production checklist

1. Strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, rotate seed admin password.
2. `DATABASE_URL` pointing at managed Postgres; run migrations.
3. `NODE_ENV=production`; disable Swagger if public.
4. Reverse proxy TLS; set CORS to known web origin.
5. Persistent volume for `uploads/` or migrate media store.
6. Backups for Postgres + audit retention policy.
