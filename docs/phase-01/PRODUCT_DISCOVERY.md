# Phase 01 — Product Discovery

**Product:** Corporate Training Portal (Internal Onboarding & Mandatory Training)  
**Audience:** Enterprise internal employees, managers, and administrators  
**Status:** Awaiting approval  

---

## 1. Product Positioning

This system is an **internal corporate training portal** for mandatory employee onboarding and compliance-related training.

| This product IS | This product is NOT |
|---|---|
| Internal enterprise application | LMS marketplace |
| Admin-driven course assignment | Moodle/self-hosted open LMS |
| Progress + audit focused | Udemy-style content discovery |
| Mandatory training workflow | Social learning / community platform |

---

## 2. User Roles

| Role | Description | Primary Goals |
|---|---|---|
| **System Admin** | Full platform control; manages configuration, users, roles, and audit visibility | Secure the platform; enforce policies; oversee all training operations |
| **Training Admin** | Creates, publishes, and assigns courses; manages content (PDF, video, quiz) | Deliver mandatory trainings on time with full traceability |
| **Manager** | Views team progress; may be notified of overdue training for direct reports | Ensure team compliance; follow up on incomplete training |
| **Employee** | Completes assigned courses, lessons, and quizzes | Finish mandatory training; resume from last position; see own status |
| **Auditor (Read-only)** *(optional MVP stretch / Future)* | Views audit logs and completion evidence without mutating data | Compliance verification and inspections |

### Role Hierarchy (logical)

```
System Admin
  └── Training Admin
        └── Manager
              └── Employee
```

- Permissions are **RBAC-based** (role + permission grants).
- A user may have **one primary role**; elevation/delegation is out of MVP unless explicitly approved.
- Managers are linked to employees via **department** and/or **reporting relationship**.

---

## 3. Functional Requirements (FR)

### 3.1 Authentication & Access Control

| ID | Requirement |
|---|---|
| FR-AUTH-01 | Users must authenticate with email/username and password. |
| FR-AUTH-02 | System must issue JWT access tokens and refresh tokens. |
| FR-AUTH-03 | Users must be able to logout (invalidate refresh session). |
| FR-AUTH-04 | Passwords must be stored using a strong one-way hash (e.g., bcrypt/argon2). |
| FR-AUTH-05 | Access to features must be enforced via RBAC (role + permissions). |
| FR-AUTH-06 | Failed login attempts must be auditable (and optionally rate-limited). |

### 3.2 User & Organization Management

| ID | Requirement |
|---|---|
| FR-USER-01 | Admins must create, update, deactivate, and list users. |
| FR-USER-02 | Users must be assigned a role (System Admin, Training Admin, Manager, Employee). |
| FR-USER-03 | Departments must be createable and assignable to users. |
| FR-USER-04 | Managers must be linkable to employees (via department and/or manager relationship). |
| FR-USER-05 | Soft-delete / deactivation preferred over hard delete for audit integrity. |

### 3.3 Course Management

| ID | Requirement |
|---|---|
| FR-COURSE-01 | Training Admins must create courses with metadata (title, description, mandatory flag, validity, etc.). |
| FR-COURSE-02 | Courses must support ordered modules and lessons. |
| FR-COURSE-03 | Lessons must support PDF content. |
| FR-COURSE-04 | Lessons must support video content. |
| FR-COURSE-05 | Courses must support draft → published lifecycle; only published courses can be assigned. |
| FR-COURSE-06 | Assignment rules must allow targeting by department and/or individual employee. |
| FR-COURSE-07 | Courses may include a quiz as a completion gate (pass required). |

### 3.4 Assignment

| ID | Requirement |
|---|---|
| FR-ASSIGN-01 | Admins must assign a published course to a department (all members). |
| FR-ASSIGN-02 | Admins must assign a published course to individual employees. |
| FR-ASSIGN-03 | Assignments must support due dates. |
| FR-ASSIGN-04 | Assignment status must include at least: Assigned, Started, Completed, Overdue. |
| FR-ASSIGN-05 | Reassignment / update of due dates must be auditable. |

### 3.5 Learning Tracking Engine

| ID | Requirement |
|---|---|
| FR-TRACK-01 | System must track PDF reading progress (current page, pages viewed, scroll position, resume position). |
| FR-TRACK-02 | System must track reading time vs idle time for PDF lessons. |
| FR-TRACK-03 | System must track video playback (play, pause, seek, playback speed, watch time). |
| FR-TRACK-04 | System must detect and record window blur / tab hidden events during learning sessions. |
| FR-TRACK-05 | All learning activity must be stored as timeline/learning events for audit. |
| FR-TRACK-06 | Employees must be able to resume a lesson from last known position. |
| FR-TRACK-07 | Completion rules for content lessons must be configurable (e.g., min watch %, min page coverage %). |

### 3.6 Quiz Module

| ID | Requirement |
|---|---|
| FR-QUIZ-01 | Admins must manage a question bank associated with courses/quizzes. |
| FR-QUIZ-02 | Quizzes may randomly select questions from a bank (configurable count). |
| FR-QUIZ-03 | Attempt limits must be configurable. |
| FR-QUIZ-04 | Passing score must be configurable. |
| FR-QUIZ-05 | System must store per-attempt results and pass/fail outcome. |
| FR-QUIZ-06 | Quiz must gate course completion when configured as required. |

### 3.7 Reporting & Dashboards

| ID | Requirement |
|---|---|
| FR-REPORT-01 | Admin dashboard: overall enrollment, completion, overdue, and course health. |
| FR-REPORT-02 | Manager dashboard: direct reports / department completion and overdue status. |
| FR-REPORT-03 | Employee dashboard: My courses, progress, due dates, overdue items. |
| FR-REPORT-04 | Course completion reports (by course, department, user). |
| FR-REPORT-05 | Audit reports (learning events, assignment changes, auth events) with filters. |

### 3.8 Audit & Compliance

| ID | Requirement |
|---|---|
| FR-AUDIT-01 | Critical actions must be written to an immutable (append-only) audit log. |
| FR-AUDIT-02 | Audit entries must capture actor, action, entity, timestamp, and contextual metadata. |
| FR-AUDIT-03 | Learning timeline events must be queryable for a given user/course/assignment. |

---

## 4. Non-Functional Requirements (NFR)

| ID | Category | Requirement |
|---|---|---|
| NFR-SEC-01 | Security | All API traffic over HTTPS in production; secrets via configuration/env only. |
| NFR-SEC-02 | Security | JWT short-lived access tokens; rotate/refresh tokens; store refresh tokens securely (hashed at rest). |
| NFR-SEC-03 | Security | RBAC enforced on every protected endpoint; deny-by-default. |
| NFR-SEC-04 | Security | Input validation on all inbound payloads (DTO-level). |
| NFR-SEC-05 | Security | Password policies configurable (min length, complexity). |
| NFR-REL-01 | Reliability | Graceful error handling; no stack traces to clients. |
| NFR-REL-02 | Reliability | Idempotent-safe writes where applicable (e.g., event ingestion with client event IDs). |
| NFR-PERF-01 | Performance | List endpoints paginated; dashboards must load within acceptable SLA (target p95 < 2s for summary APIs under expected load). |
| NFR-PERF-02 | Performance | Learning event ingestion must be lightweight and non-blocking to UX. |
| NFR-SCAL-01 | Scalability | Modular, feature-based NestJS services; DB indexes for hot query paths. |
| NFR-AVAIL-01 | Availability | Configurable timeouts and health checks for ops readiness. |
| NFR-OBS-01 | Observability | Structured application logging; correlation IDs per request. |
| NFR-AUD-01 | Auditability | Audit and learning logs retained per configurable retention policy. |
| NFR-UX-01 | Usability | Responsive UI (desktop-first, usable on tablet); clear loading/error states. |
| NFR-A11Y-01 | Accessibility | Follow WCAG 2.1 AA pragmatic targets for interactive flows (keyboard, contrast, labels). |
| NFR-MAINT-01 | Maintainability | Feature-based architecture; business logic outside controllers; SOLID; no duplicated domain rules. |
| NFR-CFG-01 | Configurability | No hardcoded environment/business constants; all via config. |
| NFR-TEST-01 | Testability | Each module independently testable (unit + integration for critical paths). |
| NFR-I18N-01 | Localization | English first in MVP; structure strings for future i18n (Future Scope). |

---

## 5. User Stories

### 5.1 Authentication

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-AUTH-01 | Employee | log in with my credentials | I can access my assigned training |
| US-AUTH-02 | Any user | stay securely logged in via refresh tokens | I am not repeatedly forced to re-enter credentials during normal use |
| US-AUTH-03 | Any user | log out | my session is no longer usable on that device |

### 5.2 Admin / Training Admin

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-ADM-01 | Training Admin | create courses with modules and PDF/video lessons | I can deliver mandatory onboarding content |
| US-ADM-02 | Training Admin | publish a course and assign it to a department or employees | the right people receive the training |
| US-ADM-03 | Training Admin | configure quiz rules (pass score, attempts, random questions) | completion is competence-gated |
| US-ADM-04 | Training Admin | view course completion and overdue reports | I can drive compliance |
| US-ADM-05 | System Admin | manage users, roles, and departments | the organization structure is reflected in the system |
| US-ADM-06 | System Admin / Auditor | review audit logs of learning and admin actions | we have evidence for compliance |

### 5.3 Manager

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-MGR-01 | Manager | see my team’s assignment statuses | I know who is incomplete or overdue |
| US-MGR-02 | Manager | filter by course and overdue status | I can follow up efficiently |

### 5.4 Employee

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-EMP-01 | Employee | see my assigned courses and due dates | I know what I must complete |
| US-EMP-02 | Employee | open PDF/video lessons and resume where I left off | I can complete training efficiently |
| US-EMP-03 | Employee | take a quiz and see pass/fail with score | I know whether I completed the course |
| US-EMP-04 | Employee | see my personal progress on a dashboard | I can track remaining work |

### 5.5 Tracking / Compliance (system-facing)

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-TRK-01 | Compliance stakeholder | have learning events (page, video, idle, blur) recorded | completion claims are evidence-backed |
| US-TRK-02 | Training Admin | define completion thresholds for content | “completed” means meaningful engagement |

---

## 6. MVP Scope

### In Scope (MVP)

1. **Auth:** Login, logout, refresh token, password hashing, JWT, RBAC  
2. **Org:** Users, roles, departments, manager–employee linkage (basic)  
3. **Courses:** Create/edit courses, modules, lessons (PDF + video), publish lifecycle  
4. **Assignment:** Assign to department and/or employee; due dates; statuses (Assigned / Started / Completed / Overdue)  
5. **Tracking:** PDF (page/scroll/time/resume), video (play/pause/seek/speed/watch time), idle + blur/hidden; learning event timeline  
6. **Quiz:** Question bank, random selection, attempts, passing score, results; gate completion when required  
7. **Reporting:** Admin, Manager, Employee dashboards; course/completion/audit reports (basic filters & export optional)  
8. **Frontend:** Angular app with auth, dashboards, course player, quiz, reports, settings  
9. **Foundation:** Configurable NestJS + Prisma + PostgreSQL; logging, validation, error handling, Swagger  

### Explicitly Out of MVP

- Marketplace / public catalog / paid content  
- SCORM/xAPI LTI integrations (evaluate later)  
- Live classrooms / webinars  
- Social features (comments, likes, forums)  
- Multi-tenant SaaS (single org assumed for MVP)  
- SSO / SAML / OIDC (Future)  
- Native mobile apps  
- AI-generated content / AI grading  
- Offline mode  
- Full CMS media pipeline (transcoding workflows) — MVP may use uploaded/URL video + PDF storage strategy defined in architecture  

### MVP Success Criteria

- Admin can publish a mandatory course (PDF + video + quiz) and assign by department  
- Employee can complete end-to-end with resumable progress and tracked events  
- Overdue is correctly computed and visible to Manager/Admin  
- Audit timeline exists for a completed assignment  
- Roles cannot access unauthorized APIs/screens  

---

## 7. Future Scope

| Area | Candidates |
|---|---|
| Identity | SSO (SAML/OIDC), MFA, SCIM user provisioning |
| Content | SCORM/xAPI, captions, multi-language content, video transcoding pipeline |
| Learning | Certificates, re-certification schedules, learning paths, prerequisites |
| Collaboration | Manager acknowledgements, coach notes, escalations/workflows |
| Notifications | Email/Teams/Slack reminders for assignment & overdue |
| Analytics | Advanced cohort analytics, risk scoring for disengagement |
| Platform | Multi-tenancy, white-label, high-availability HA topology |
| Compliance | Tamper-evident audit store, e-signature acknowledgement |
| UX | PWA, deeper a11y certifications, i18n |
| Integrations | HRIS (Workday/Bamboo), document storage (S3/SharePoint) |

---

## 8. Assumptions & Constraints

| ID | Assumption / Constraint |
|---|---|
| A-01 | Single organization (one company) for MVP. |
| A-02 | Users are provisioned by Admins (no self-registration). |
| A-03 | Content is internal and confidential; access must be authenticated. |
| A-04 | PostgreSQL is the system of record. |
| A-05 | Frontend: Angular 20 + TailwindCSS + PrimeNG; Backend: NestJS + Fastify + Prisma. |
| A-06 | Tracking accuracy depends on client event reporting; server validates and stores events. |
| A-07 | Media storage approach (local/dev vs object storage) will be decided in Phase 02/03. |

---

## 9. Open Questions (for approval discussion)

1. Is **Manager** limited to view-only, or can Managers assign training to their team in MVP?  
2. Should **Auditor** be a distinct role in MVP, or Admin-only audit access?  
3. Preferred media storage for MVP: local filesystem (dev) + S3-compatible (prod path), or URL-only videos?  
4. Is password **self-reset** in MVP, or admin reset only?  
5. Minimum completion rules defaults (e.g., 90% video watch, 100% PDF pages)?  
6. Soft delete retention vs hard anonymization for offboarded employees?  

---

## 10. Phase Gate (Lead Architect Close-out)

### Deliverables

| # | Deliverable | Location |
|---|---|---|
| 1 | Functional Requirements (FR) | Sections 3.1–3.8 |
| 2 | Non-Functional Requirements (NFR) | Section 4 |
| 3 | User Stories | Section 5 |
| 4 | User Roles | Section 2 |
| 5 | MVP Scope | Section 6 |
| 6 | Future Scope | Section 7 |

### Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | Learning tracking (idle/blur/seek) may be contested as “insufficient proof” of completion | Compliance disputes | Define explicit completion thresholds + retain event timeline |
| R-02 | Client-reported events can be spoofed | Weak audit integrity | Server-side validation, rate limits, session binding (Architecture phase) |
| R-03 | Unclear Manager permissions cause rework | Scope churn in Phases 06–08 / 11 | Resolve Open Question #1 before Phase 02 |
| R-04 | Media storage decision deferred | Blocks Course/Lesson design | Resolve Open Question #3 before/during Phase 02 |
| R-05 | Over-scoped MVP delays first usable release | Schedule slip | Protect Out-of-MVP list; no feature creep without gate approval |

### Improvements (recommended before / during next phases)

1. Freeze open questions as **Approved Decisions** (AD-xx) before architecture.  
2. Add a short **persona matrix** (goals vs non-goals per role) if stakeholders need alignment.  
3. Define a **definition of done** per phase (tests + docs + approval).  
4. Introduce a **decision log** starting Phase 02 to prevent silent scope changes.

### What should be reviewed

- Role model and permission boundaries (esp. Manager vs Training Admin)
- MVP vs Future Scope cut-line
- Tracking/compliance expectations (what “Completed” legally means)
- All open questions in Section 9
- Assumptions A-01–A-07

### Next phase

**Phase 02 — System Architecture**  
(High-level architecture, modules, folder structure, security/authz flows, logging, errors, validation, coding standards)

**Authority note:** No Phase 02 artifacts and no implementation code until written approval of Phase 01.
