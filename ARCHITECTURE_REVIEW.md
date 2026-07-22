# Architecture & Code Review

**Product:** Zebl Corporate Training Portal  
**Document type:** Enterprise architecture and code quality review  
**Audience:** Engineering leadership, security, and product stakeholders  
**Review stance:** Production-readiness assessment for enterprise customers  
**Date:** 15 July 2026  
**Reviewer role:** Principal Software Architect  

> This review is diagnostic only. No application code was modified as part of this assessment.

---

# Executive Summary

Zebl LMS is a **well-shaped mid-maturity enterprise training portal**: clear monorepo boundaries, modern Angular 20 + NestJS/Fastify/Prisma stack, consistent API envelopes, deny-by-default JWT with role gates, and a coherent LMS domain (courses → assignments → learning events → quiz → reports).

It is **not yet enterprise-production-ready** for regulated/HR-sensitive training content.

The highest-risk gaps are:

1. **Unauthenticated public serving of uploaded PDF/video content**
2. **Incomplete auth session lifecycle** (no access-token revalidation of user status; unused refresh on the client; no rate limiting)
3. **Quiz / completion integrity holes** (quiz lesson can be completed without a passing attempt; attempt question sets not persisted)
4. **Manager reports RBAC gap** (`employee-progress` is not scoped to the manager’s team)
5. **Near-absent automated tests and no CI pipeline**
6. **God services / god components** that will slow delivery and raise defect rate

**Overall score: 6.4 / 10** — strong foundation, insufficient hardening for enterprise GA.

**Verdict:** Suitable as an **internal MVP / pilot**. Require the Immediate and Short-term roadmap items before external enterprise customer release.

---

# Project Overview

| Attribute | Detail |
|---|---|
| Intent | Internal corporate onboarding / mandatory training portal (not a public marketplace) |
| Frontend | Angular 20, Standalone, Signals, PrimeNG Aura, Tailwind CSS v4 |
| Backend | NestJS 11, Fastify, Prisma 6, Pino, Zod env validation |
| Database | PostgreSQL 16 (Docker Compose) |
| Auth model | JWT access + hashed refresh tokens; roles `SUPER_ADMIN` · `ADMIN` · `MANAGER` · `EMPLOYEE` |
| Packaging | npm workspaces (`apps/api`, `apps/web`, `packages/shared`) |
| Documentation | Strong phase gates (Phases 1–5) and coding standards |

### What works well

- Feature-based Nest modules and Angular `core` / `features` / `shared` layout
- Shared `@zebl/shared` contracts for roles and API envelopes
- Learning player layout is intentional and consistent
- Audit logging and notifications exist as first-class concepts
- Env validation at boot; structured logging with request IDs
- Soft deletes on core domain entities

### What does not yet meet enterprise bar

- Security of training media and auth session controls
- Compliance-grade quiz integrity
- Horizontal scalability (local disk uploads, in-memory analytics aggregation)
- Test/CI maturity
- Component and service size discipline

---

# Architecture Review

## Architectural style

Layered modular monolith:

```text
Web (Angular SPA)
   ↓  HTTPS / JWT
API (Nest modules)
   ↓  Prisma
PostgreSQL + local filesystem uploads
```

This is an appropriate starting architecture for an HR training portal. Microservice split is not needed yet (and would be YAGNI).

## Strengths

| Strength | Why it matters |
|---|---|
| Clear module boundaries | Features map to business capabilities |
| Deny-by-default JWT + `@Public` | Correct enterprise security default |
| Infrastructure vs feature split | Auth, Prisma, storage, audit are reusable ports |
| Shared package for contracts | Prevents FE/BE drift on envelopes and roles |
| Phase documentation | Decision history is recoverable |

## Weaknesses

| Weakness | Severity | Impact |
|---|---|---|
| Local filesystem media + public static mount | **Critical** | Training content can leak without auth |
| Domain logic concentrated in 2–3 services | **High** | Change risk, hard testing |
| FE page monoliths | **High** | Slow UX iteration, brittle UI |
| No async boundary for learning events | **High** | Scale and reliability ceiling |
| Incomplete permission model (`permissions: []`) | **Medium** | Role-only RBAC will hit limits |
| Dual quiz config (`Lesson.quizConfig` JSON + `Quiz` table) | **Medium** | Configuration drift |

## Module boundaries

**Backend modules:** `auth`, `users`, `departments`, `media`, `courses`, `learning`, `quiz`, `reports`, `notifications`, `health`.

- Quiz → Learning (one-way) is healthy today; introducing Learning → Quiz without an events/outbox layer will create a cycle.
- `NotificationModule` (infra) vs `NotificationsModule` (API) naming is confusing.

**Frontend:** Route lazy-loading is correct. Features are page monoliths rather than feature libraries with presenters + facades.

## SOLID / DRY / KISS / YAGNI

| Principle | Assessment |
|---|---|
| **S**ingle responsibility | Violated by `CoursesService`, `LearningService`, course editor/player pages |
| **O**pen/closed | Acceptable for current size |
| **L**iskov / **I**nterface segregation | Thin interfaces; limited domain ports |
| **D**ependency inversion | Controllers → services → Prisma is present; little abstraction beyond that |
| **DRY** | Duplicated role checks, media URL builders, HTTP unwrap, CRUD page patterns |
| **KISS** | Generally good product scope discipline |
| **YAGNI** | Mostly good; leftover foundation/home/shell pages violate it |

---

# Frontend Review

**Score drivers:** Modern Angular patterns yes; enterprise UX rails incomplete.

## Structure

```text
apps/web/src/app/
  core/       auth, interceptors, HTTP APIs, theme, models
  features/   pages (auth, courses, learning, reports, …)
  layout/     dashboard shell
  shared/     presentational widgets (pdf, video, quiz, header, …)
```

## Strengths

- Standalone components + route-level `loadComponent`
- Signals used for page state and auth/theme/notification counts
- Design tokens (`--ctp-*`) and dark-mode class toggle
- Shared player media components and quiz runner/bank editor
- Skip link and basic focus-visible styles

## Issues

### FE-1 — Unused refresh + no 401 recovery
| Field | Detail |
|---|---|
| **Severity** | **Critical** |
| **Why** | `AuthService.refresh()` exists but is never called. Error interceptor does not handle 401. Access token expiry leaves the SPA broken until hard reload. |
| **Business impact** | Users mid-training lose trust; support load rises; incomplete audits of “abandoned” sessions. |
| **Technical impact** | Stale sessions; failed API storms; security posture mismatches backend refresh rotation. |
| **Solution** | Interceptor: 401 → single-flight refresh → retry queue; on failure → clear session → `/login`. |
| **Effort** | 2–3 days |

### FE-2 — God components
| Field | Detail |
|---|---|
| **Severity** | **High** |
| **Why** | `course-editor-page` (~856 lines), `course-player-page` (~610), `reports-page` (~457) mix template, styles, orchestration, and domain UX. |
| **Business impact** | Slow feature delivery; higher regression risk on content authoring. |
| **Technical impact** | Hard unit testing; merge conflicts; poor reuse. |
| **Solution** | Split into presentational children + feature services (`CourseEditorFacade`, `PlayerFacade`). Extract dialogs, rule forms, lesson list, report tables. |
| **Effort** | 1–2 weeks |

### FE-3 — PrimeNG dark mode mismatch
| Field | Detail |
|---|---|
| **Severity** | **Medium** |
| **Why** | Custom `html.dark` tokens; `providePrimeNG({ darkModeSelector: false })` so Aura controls ignore theme. |
| **Business impact** | Unprofessional “half dark” UI for users who expect Microsoft/Atlassian consistency. |
| **Technical impact** | CSS fights between tokens and PrimeNG surfaces. |
| **Solution** | Align `darkModeSelector` with `html.dark` or own all chrome without mixed theming. |
| **Effort** | 1–2 days |

### FE-4 — Dead scaffold code
| Field | Detail |
|---|---|
| **Severity** | **Low** |
| **Why** | Unused `home`, `foundation`, `shell-layout`, `empty-state`, `joinUrl`. |
| **Business impact** | Confusion for new engineers. |
| **Technical impact** | Noise in search/reviews. |
| **Solution** | Delete or quarantine unused artifacts. |
| **Effort** | 0.5 day |

### FE-5 — Duplication of cross-cutting helpers
| Field | Detail |
|---|---|
| **Severity** | **Medium** |
| **Why** | Role predicates, `mediaUrl`, API error extraction, CRUD table+dialog patterns repeated. `ApiClient` underused. |
| **Business impact** | Inconsistent messages and access rules. |
| **Technical impact** | Drift bugs (one page fixed, another not). |
| **Solution** | `RoleService`, `MediaUrlPipe`/`util`, `toast`/`confirm` services, standardize on `ApiClient`. |
| **Effort** | 3–5 days |

### FE-6 — Subscription / change detection hygiene
| Field | Detail |
|---|---|
| **Severity** | **Medium** |
| **Why** | Imperative `.subscribe()` without `takeUntilDestroyed`; no `OnPush`. Learning tracker + notifications may leak subscriptions. |
| **Business impact** | Potential memory growth on long player sessions. |
| **Technical impact** | Harder performance tuning. |
| **Solution** | Prefer `async` pipe / `toSignal`; OnPush on list/player components; destroy hooks for trackers. |
| **Effort** | 3–5 days |

### State management

Local signals + HTTP services are fine at current scale. Do **not** introduce NgRx yet (YAGNI). Introduce thin facades when editor/player are split.

### Routing

Sound role guards. Auth guard checks token presence only (not expiry/validity) — reinforce with interceptor work in FE-1.

---

# Backend Review

## Strengths

- Global guards, ValidationPipe (`whitelist` + `forbidNonWhitelisted`), response interceptor, exception filter
- Zod-validated configuration
- Pino structured logs with secret redaction and request IDs
- Refresh tokens hashed; rotation with revoke metadata
- Soft-delete filters commonly applied in queries
- Domain coverage for LMS lifecycle is complete enough for MVP

## Issues

### BE-1 — Learning / Courses god services
| Field | Detail |
|---|---|
| **Severity** | **High** |
| **Why** | `courses.service.ts` (~759 lines), `learning.service.ts` (~693 lines) own authoring, rules, player, ingest, progress. |
| **Business impact** | Defects in progress tracking block mandatory training SLAs. |
| **Technical impact** | Untestable units; risky deploys. |
| **Solution** | Split into `CourseCatalogService`, `AssignmentService`, `ProgressService`, `LearningIngestService`. |
| **Effort** | 1–2 weeks |

### BE-2 — Learning event ingest not transactional / batched
| Field | Detail |
|---|---|
| **Severity** | **High** |
| **Why** | Sequential per-event processing with multiple queries; limited use of `$transaction` across progress + assignment updates. |
| **Business impact** | Inaccurate progress under concurrent tabs; reporting distrust. |
| **Technical impact** | CPU/DB chatter; race conditions. |
| **Solution** | Batch upserts; per-batch transaction; optional queue (SQS/BullMQ) for analytics events. |
| **Effort** | 1 week (+ queue later) |

### BE-3 — Quiz integrity incomplete
| Field | Detail |
|---|---|
| **Severity** | **Critical** |
| **Why** | Served question set is reshuffled on resume; scoring trusts submitted answers without binding to the served set; QUIZ lessons can be marked complete via learning APIs without a passing attempt. |
| **Business impact** | Compliance failure for mandatory exams; legal/HR exposure. |
| **Technical impact** | Non-reproducible attempts; gaming the system. |
| **Solution** | Persist `attemptQuestionIds` (JSON or join table); score only that set; require all answers; reject `markLessonComplete` for QUIZ unless `passed` attempt exists. |
| **Effort** | 3–5 days |

### BE-4 — Reports manager scoping bug
| Field | Detail |
|---|---|
| **Severity** | **Critical** |
| **Why** | `ReportsController.employeeProgress()` calls service **without** manager-scoped IDs although service supports them. Managers can see all employees’ progress. |
| **Business impact** | Privacy / employee data leakage across teams. |
| **Technical impact** | Direct RBAC violation of least privilege. |
| **Solution** | Resolve manager’s team IDs and pass into `employeeProgress`; add integration tests. |
| **Effort** | 1 day |

### BE-5 — Thin / inconsistent pagination on reports
| Field | Detail |
|---|---|
| **Severity** | **Medium** |
| **Why** | Hard `take` caps; some endpoints load large graphs into memory (quiz analytics over all attempts). |
| **Business impact** | Dashboards timeout as adoption grows. |
| **Technical impact** | Memory spikes; uneven API contracts. |
| **Solution** | Shared `PaginationQueryDto`; DB aggregation; optional materialized views for analytics. |
| **Effort** | 1 week |

### BE-6 — Audit writes outside transactions
| Field | Detail |
|---|---|
| **Severity** | **Medium** |
| **Why** | Audit append often sits outside domain `$transaction`. |
| **Business impact** | Incomplete compliance trail under partial failures. |
| **Technical impact** | Orphan audits or silent audit misses. |
| **Solution** | Write audit in same transaction or use transactional outbox. |
| **Effort** | 3–5 days |

### Error handling & logging

- Envelope and filter quality are good for this stage.
- Missing: OpenTelemetry/Sentry, alert thresholds, Prisma query error listeners fully utilized.
- Auth endpoints lack throttling (see Security).

### DTO / validation

Strong class-validator usage. `enableImplicitConversion: true` can coerce unexpected query types — prefer explicit `@Type()` transforms for public query DTOs.

---

# Database Review

## Strengths

- Normalized LMS schema with clear enums
- Soft deletes on core entities
- Sensible indexes on status, FKs, timeline lookups
- Unique constraints on quiz attempts per assignment numbering
- Migrations exist for phased evolution

## Issues

### DB-1 — Missing foundation migration file previously empty
| Field | Detail |
|---|---|
| **Severity** | **Medium** (ops) |
| **Why** | Empty `20260715160000_foundation_init` blocked deploy until patched with a stub. |
| **Business impact** | Failed environments / blocked onboarding. |
| **Technical impact** | Fragile migrate history. |
| **Solution** | Treat migrations as immutable; add CI check that every migration folder contains `migration.sql`. |
| **Effort** | 0.5 day |

### DB-2 — `CourseAssignment.ruleId` without FK
| Field | Detail |
|---|---|
| **Severity** | **Low** |
| **Why** | Loose string link to assignment rules. |
| **Business impact** | Harder lineage of “why was this assigned?” |
| **Technical impact** | Orphan references. |
| **Solution** | Optional FK or documented intentional denormalization. |
| **Effort** | 1 day |

### DB-3 — Dual quiz configuration surfaces
| Field | Detail |
|---|---|
| **Severity** | **Medium** |
| **Why** | `Lesson.quizConfig` JSON alongside relational `Quiz` model. |
| **Business impact** | Authors configure wrong place; inconsistent behavior. |
| **Technical impact** | Drift and ambiguous source of truth. |
| **Solution** | Deprecate JSON; Quiz table only. |
| **Effort** | 1–2 days |

### DB-4 — Analytics without warehouse path
| Field | Detail |
|---|---|
| **Severity** | **Medium** (scale) |
| **Why** | Reports group/aggregate on OLTP tables. |
| **Business impact** | Slow manager dashboards at 10k+ employees. |
| **Technical impact** | Lock contention risk. |
| **Solution** | Nightly rollups / read replica / warehouse later. |
| **Effort** | 2–4 weeks (long-term) |

### Indexes / queries

Indexes are generally adequate for MVP. Watch:

- Learning event inserts under heavy concurrent players
- `employeeProgress` unbounded include graphs
- Quiz analytics full-table attempt scans

---

# Security Review

## Strengths

- JWT deny-by-default; role decorator pattern
- Bcrypt passwords; refresh token hashing + rotation metadata
- Password change/reset revokes refresh sessions
- Forgot-password anti-enumeration messaging
- Pino redacts Authorization headers
- MIME/size allow-lists on uploads

## Issues

### SEC-1 — Public static uploads (unauthenticated media)
| Field | Detail |
|---|---|
| **Severity** | **Critical** |
| **Why** | Fastify static serves `STORAGE_ROOT_DIR` without auth. Knowledge of URL = access to PDFs/videos. |
| **Business impact** | Confidential HR/compliance content leakage; contract/security findings that block enterprise deals. |
| **Technical impact** | No authorization, no audit of media reads. |
| **Solution** | Private object storage (S3/Azure Blob) + short-lived signed URLs; or authenticated streaming endpoints. Remove anonymous static serving. |
| **Effort** | 1–2 weeks |

### SEC-2 — No rate limiting on auth endpoints
| Field | Detail |
|---|---|
| **Severity** | **High** |
| **Why** | Login / forgot-password / refresh have no throttling. |
| **Business impact** | Credential stuffing and reset abuse. |
| **Technical impact** | CPU/bcrypt DoS. |
| **Solution** | Nest throttler or API gateway limits; account lockout policy using `UserStatus.LOCKED`. |
| **Effort** | 2–3 days |

### SEC-3 — JWT strategy does not re-check user status
| Field | Detail |
|---|---|
| **Severity** | **High** |
| **Why** | Deactivated/deleted/locked users remain valid until access token expires. |
| **Business impact** | Former employees retain temporary access. |
| **Technical impact** | RBAC status drift. |
| **Solution** | Validate `status` + `deletedAt` (cacheable) on each request or short TTL + forced logout list. |
| **Effort** | 2–3 days |

### SEC-4 — Refresh reuse detection missing
| Field | Detail |
|---|---|
| **Severity** | **Medium** |
| **Why** | Stolen rotated refresh returns 401 but does not revoke token family. |
| **Business impact** | Session hijack residual risk. |
| **Technical impact** | Incomplete rotation security model. |
| **Solution** | On reuse of revoked refresh, revoke all user refresh tokens. |
| **Effort** | 1–2 days |

### SEC-5 — Tokens in `localStorage`
| Field | Detail |
|---|---|
| **Severity** | **Medium** |
| **Why** | XSS exfiltrates access + refresh. |
| **Business impact** | Account takeover. |
| **Technical impact** | Hardens need for CSP + sanitization. |
| **Solution** | Prefer httpOnly Secure cookies for refresh (and optionally access); CSP; Angular security reviews. |
| **Effort** | 1 week |

### SEC-6 — Swagger enabled by default
| Field | Detail |
|---|---|
| **Severity** | **Medium** |
| **Why** | `SWAGGER_ENABLED` defaults to `true`. |
| **Business impact** | API surface exposed in misconfigured deploys. |
| **Technical impact** | Attack discovery aid. |
| **Solution** | Default `false` in production; protect or disable entirely. |
| **Effort** | 0.5 day |

### SEC-7 — Non-prod reset token in API responses
| Field | Detail |
|---|---|
| **Severity** | **Low** (ops) |
| **Why** | Convenient for local; dangerous if `NODE_ENV` wrong. |
| **Solution** | Gate strictly; never log tokens; mailer in staging/prod. |
| **Effort** | 0.5 day |

---

# Performance Review

| Area | Assessment |
|---|---|
| FE lazy routes | Good |
| Player tracking | Client timers + frequent POSTs — needs batching/backoff |
| Media upload | Full buffer into memory for large videos — **High** risk |
| Reports | Parallel admin dashboard good; quiz analytics in-memory weak |
| Caching | None (Redis/CDN absent) — acceptable MVP, not scale |
| Horizontal scale | Sticky local disk blocks multi-instance API |

### PERF-1 — Multipart buffered in memory
| Field | Detail |
|---|---|
| **Severity** | **High** |
| **Why** | Large video uploads held as buffers. |
| **Business impact** | API OOM under concurrent uploads. |
| **Solution** | Stream to disk/object storage; size limits at proxy. |
| **Effort** | 3–5 days |

### PERF-2 — No CDN / media offload
| Field | Detail |
|---|---|
| **Severity** | **Medium** |
| **Why** | API serves bytes. |
| **Business impact** | Cost and latency under load. |
| **Solution** | Object storage + CDN after SEC-1. |
| **Effort** | Included with SEC-1 |

---

# UI Review

Compared against **Microsoft (Fluent/HR portals)**, **Atlassian**, and **Linear** quality bars.

## Strengths

- Coherent teal corporate shell; intentional player layout (Left / Center / Right / Bottom)
- Shared page header and stat cards give a portal feel
- Dark mode toggle exists as a product gesture
- Responsive stacking for shell and player is present
- Forms generally use PrimeNG controls

## Gaps vs enterprise design systems

| Area | Finding | Severity |
|---|---|---|
| Spacing / rhythm | Generally decent; panels overused like cards | Low–Medium |
| Typography | Segoe/IBM stack is enterprise-credible; no loaded brand webfont | Low |
| Tables | Mixed hand-rolled (reports) vs `p-table` elsewhere | Medium |
| Feedback | No global toast; native `confirm()` for deletes | Medium |
| Navigation | Desktop-first; mobile is horizontal scroll, not drawer IA | Medium |
| Accessibility | Skip link + focus-visible good start; tabs incomplete; weak live regions | Medium–High |
| Consistency | Hardcoded sidebar colors vs CSS tokens; PrimeNG theming mismatch | Medium |
| Professional polish | Functional, not yet Fluent/Atlassian-level density and motion discipline | Medium |

**UI score rationale:** Credible internal portal aesthetics (~6.5/10), but not yet a design-system product. Do **not** redesign; harden tokens, a11y, and feedback rails first — matching your stated UX constraints.

---

# Technical Debt

| Debt item | Type | Severity |
|---|---|---|
| Public local uploads | Security / architecture | Critical |
| Quiz attempt persistence & completion bypass | Domain integrity | Critical |
| Manager report scoping | Security / privacy | Critical |
| Missing CI + thin tests | Quality process | High |
| God services/components | Maintainability | High |
| Unused client refresh | Auth correctness | High |
| Dead scaffold pages/utils | Cleanliness | Low |
| Dual quiz config fields | Model clarity | Medium |
| No object storage / queue | Scalability | High (future load) |
| Permissions array unused | Incomplete RBAC | Medium |
| Reports unbounded queries | Performance | Medium |

**Estimated debt burn-down to “enterprise hard GA”:** ~6–10 engineering weeks for Immediate + Short-term items (one senior + one mid engineer).

---

# Risk Analysis

| Risk | Likelihood | Impact | Production blocker? |
|---|---|---|---|
| Training media URL leakage | High | Critical | **Yes** |
| Quiz gaming / compliance failure | Medium–High | Critical | **Yes** for exam courses |
| Cross-team PII via reports | Medium | High | **Yes** if managers enabled |
| Account stuffing / brute force | High | High | **Yes** for internet-facing |
| Session after offboarding | Medium | High | Strongly advised |
| Learning progress drift | Medium | Medium | Soft blocker |
| Multi-instance deploy broken by disk | High (if scaled) | High | Yes when HA required |
| No CI regressions | High | Medium | Soft blocker |

### Missing enterprise features

- SSO / SAML / OIDC (Entra ID)
- SCIM provisioning
- Email / Teams notifications
- Content DRM / watermarking
- Learning certifications & expiry
- Manager attestations
- Data retention / GDPR export-delete workflows
- Feature flags / environment promotion pipeline
- Multi-tenant isolation (if SaaS)
- Offline / mobile native learning
- Full WCAG 2.2 AA conformance program

---

# Production Readiness

| Gate | Status |
|---|---|
| Functional MVP domain | Pass |
| Security baseline for confidential training | **Fail** |
| Auth abuse protections | **Fail** |
| Quiz compliance integrity | **Fail** |
| Observability (APM/error) | Partial |
| Automated tests + CI | **Fail** |
| HA / multi-instance | **Fail** |
| Secrets / prod defaults | Partial (Swagger default, seed passwords) |
| Docs / runbooks | Partial (good phase docs; thin ops runbook) |
| Accessibility program | Partial |

**Ready for:** controlled internal pilot with trusted network + known content sensitivity.  
**Not ready for:** external enterprise customer GA, regulated compliance examinations, multi-region HA.

---

# Recommendations

## Keep

- Modular Nest + Angular standalone architecture
- API envelope and Zod env validation
- Player layout and CSS token approach (extend, don’t redesign)
- Phase-gated delivery discipline

## Fix before GA

1. Authenticated / signed media access  
2. Quiz attempt binding + block bypass completion  
3. Manager-scoped reports  
4. Auth throttling + status revalidation + client refresh  
5. CI with unit + critical path e2e  

## Improve next

- Split god services/components  
- Stream uploads; object storage  
- Global toast/confirm; PrimeNG dark alignment  
- Learning ingest batching / queue  
- Broader integration tests  

## Postpone (not now)

- Microservices  
- Full NgRx  
- Data warehouse (until metrics scale)  

---

# Prioritized Action Plan

## Immediate (0–2 weeks) — production blockers

| # | Action | Owner suggestion | Effort |
|---|---|---|---|
| 1 | Remove anonymous static media; serve via auth or signed URLs | Backend | 1–2 wks |
| 2 | Persist quiz attempt questions; block QUIZ complete-without-pass | Backend | 3–5 d |
| 3 | Scope `employee-progress` to manager team + tests | Backend | 1 d |
| 4 | Wire FE refresh interceptor + forced logout | Frontend | 2–3 d |
| 5 | Rate-limit auth endpoints; disable Swagger by default in prod | Backend/DevOps | 2 d |
| 6 | Re-validate user status on JWT | Backend | 2–3 d |
| 7 | Add GitHub Actions: build + unit + migrate dry-run | DevOps | 2 d |

## Short-term (2–6 weeks)

| # | Action | Effort |
|---|---|---|
| 8 | Split Courses/Learning services; split editor/player components | 2 wks |
| 9 | Stream uploads; introduce S3/Azure Blob | 1–2 wks |
| 10 | Global toast + ConfirmDialog; kill `window.confirm` | 3 d |
| 11 | Align PrimeNG dark mode; tokenized sidebar | 2 d |
| 12 | Batch learning events; add integration tests for ingest idempotency | 1 wk |
| 13 | Refresh token reuse revocation; optional lockout | 3 d |
| 14 | A11y pass on shell, dialogs, reports tabs (WCAG AA target) | 1 wk |
| 15 | Delete dead foundation/home/shell code | 0.5 d |

## Long-term (6–16 weeks)

| # | Action | Effort |
|---|---|---|
| 16 | SSO (Entra ID / OIDC) | 2–4 wks |
| 17 | Email/Teams notification channels | 1–2 wks |
| 18 | Analytics rollups / read replica | 2–4 wks |
| 19 | Permissions model beyond roles | 2 wks |
| 20 | Certification expiry & recertification workflows | 2–3 wks |
| 21 | Full e2e suite for learning + quiz compliance paths | 2 wks |
| 22 | Multi-instance HA with shared storage + sticky-less design | 2–3 wks |

## Future enhancements

- SCIM, watermarking, offline mobile, multi-tenant SaaS isolation, learning pathways / curricula, AI content assist, advanced proctoring signals.

---

# Overall Score

Scores are **/10**, calibrated for enterprise customer release readiness (not student projects).

| Dimension | Score | Notes |
|---|---:|---|
| Architecture | **7.5** | Sound modular monolith; media/auth hardening incomplete |
| Folder Structure | **8.0** | Clear FE/BE/shared; minor dead scaffolds |
| Frontend | **6.5** | Modern Angular; god pages; incomplete auth UX |
| Backend | **7.0** | Solid Nest patterns; god services; quiz/report gaps |
| Database | **7.0** | Good schema/indexes; OLTP analytics ceiling |
| Security | **4.5** | Critical media + several auth gaps |
| Performance | **6.0** | Fine for pilot; upload/report scale risks |
| Maintainability | **6.0** | Docs help; size and duplication hurt |
| Scalability | **5.0** | Single-node disk; no queue/cache |
| Code Quality | **6.5** | Consistent style; thin tests |
| Production Readiness | **5.0** | Pilot yes; enterprise GA no |
| **Overall** | **6.4** | Weighted toward security and production gates |

### Score interpretation

| Band | Meaning |
|---|---|
| 9–10 | Enterprise-hardened reference |
| 7–8 | Strong product; minor hardening left |
| 5–6 | Viable pilot; GA blocked on risks |
| &lt;5 | Do not ship externally |

---

# Strengths (Summary)

1. Coherent enterprise LMS domain model and phased delivery docs  
2. Modern stack choices appropriate for the problem  
3. Deny-by-default API security skeleton  
4. Shared contracts and consistent response envelopes  
5. Thoughtful learning player UX structure  
6. Audit + notifications foundations already present  

# Weaknesses (Summary)

1. Unauthenticated media exposure  
2. Quiz and reports integrity / privacy holes  
3. Incomplete session lifecycle (client + server)  
4. Missing CI/tests as quality gates  
5. Large services/components and duplicated FE helpers  
6. Local storage architecture limits HA  

# Quick Wins (&lt; 1 week each)

- Fix manager `employee-progress` scoping  
- Block QUIZ `markLessonComplete` without pass  
- Wire refresh interceptor  
- Default Swagger off in production  
- Add auth throttling  
- Delete dead scaffold pages  
- CI: `build` + unit tests on PR  

# Long-term Improvements

- SSO + SCIM  
- Object storage + CDN  
- Service/component decomposition  
- Analytics warehouse path  
- WCAG program and design-system consolidation  

---

# Appendix A — Highest-severity issue index

| ID | Title | Severity |
|---|---|---|
| SEC-1 | Public static uploads | Critical |
| BE-3 | Quiz integrity / completion bypass | Critical |
| BE-4 | Manager reports unscoped | Critical |
| FE-1 | Unused refresh / no 401 handling | Critical |
| SEC-2 | No auth rate limiting | High |
| SEC-3 | JWT ignores user status | High |
| BE-1 / FE-2 | God services / components | High |
| BE-2 / PERF-1 | Ingest + upload scalability | High |

# Appendix B — Review method

- Static review of `apps/api`, `apps/web`, `packages/shared`, `docs`, `docker-compose.yml`
- Cross-checked high-severity claims against source (`main.ts` static mount, `reports.controller.ts` scoping, auth refresh usage)
- Evaluated against project coding standards and Phase 5 production notes
- Compared UI posture to Microsoft / Atlassian / Linear enterprise product norms **without proposing a redesign**

---

*End of report.*
