# Architecture Decisions — Phase 3 Courses

## AD-30: Local filesystem media storage for MVP

Uploads are stored under configurable `STORAGE_ROOT_DIR` and served via Fastify static at `STORAGE_PUBLIC_BASE_URL`. Object storage can replace this adapter later without changing domain models.

## AD-31: Quiz lesson type exists without quiz engine

`LessonType.QUIZ` is allowed with optional `quizConfig` JSON. Publish does not require quiz content media. Quiz engine is deferred.

## AD-32: Publish gate validates structure + media

Publishing requires ≥1 module, ≥1 lesson, and PDF/VIDEO lessons must have content media attached.

## AD-33: Assignment rules are declarative only

Rules define future audience (all / department / employee). Enrollment/assignment execution is deferred to Assignment phase.

## AD-34: Course admin restricted to SUPER_ADMIN + ADMIN

Managers and employees cannot call course APIs or see Courses nav/routes.

## AD-35: Drag-drop ordering persisted via reorder endpoints

Angular CDK reorders client-side then POSTs ordered IDs; server rewrites `sortOrder` atomically.
