# Phase 5 — Enterprise Completion

## Deliverables

| Area | Status |
|---|---|
| Quiz engine (bank, random draw, pass score, attempts, results) | Done |
| Admin / Manager / Employee dashboards | Done |
| Course completion + employee progress reports | Done |
| Reading / video / quiz analytics | Done |
| Audit log viewer | Done |
| Notifications (API + shell bell) | Done |
| Dark mode (CSS variables + toggle) | Done |
| Accessibility (skip link, focus-visible, aria labels) | Done |
| Responsive refinements (shell, reports, player) | Done |
| Security review notes | Done |
| API documentation (Swagger + phase notes) | Done |
| Production readiness checklist | Done |

## Quiz

- Admin configures bank per QUIZ lesson (passing %, questions per attempt, max attempts, shuffle).
- Learner starts attempt → random subset, shuffled options.
- Pass marks lesson complete and sends a notification.
- Fail allows retry until max attempts.

## Dashboards

- **Admin** — Overview + Reports (executive metrics, analytics, audit).
- **Manager** — Team open/completed/overdue + Reports tabs.
- **Employee** — Personal assigned / in-progress / completed / overdue + My Learning.

## UI policy

No redesign. Existing teal enterprise shell preserved. Dark mode uses the same tokens (`--ctp-*`).

## Migrate

```bash
npm run prisma:migrate:deploy -w @zebl/api
```

## Verify

```bash
npm run build -w @zebl/shared
npm run build -w @zebl/api
npm run build -w @zebl/web
```

Swagger: `http://localhost:3000/api/docs` (dev).
