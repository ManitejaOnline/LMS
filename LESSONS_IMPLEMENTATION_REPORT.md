# Lessons Implementation Report

Phase: **Lessons only** (PDF + Video). Quizzes and assessments were not implemented.

## Files changed

### Backend

- `apps/api/prisma/schema.prisma` — added `LessonStatus` enum and `Lesson.status`
- `apps/api/prisma/migrations/20260810040000_lesson_status/migration.sql`
- `apps/api/src/modules/courses/courses.controller.ts` — course-scoped lesson list/create/reorder + get lesson
- `apps/api/src/modules/courses/courses.service.ts` — primary module wrapper, course lesson CRUD/reorder, publish requires PDF/video media
- `apps/api/src/modules/courses/dto/create-lesson.dto.ts` — optional `status`
- `apps/api/src/modules/courses/dto/update-lesson.dto.ts` — optional `status`
- `apps/api/src/modules/learning/learning.controller.ts` — learner lesson list/progress/complete
- `apps/api/src/modules/learning/learning.service.ts` — sequential lock on player payload, enrollment + previous-lesson checks, video threshold complete
- `apps/api/src/modules/learning/learning.module.ts` — `SequentialAccessService`
- `apps/api/src/modules/learning/learning.constants.ts` — `VIDEO_COMPLETION_PERCENT = 90`
- `apps/api/src/modules/learning/page-progress.service.ts` — sequential access on page timer; auto-complete PDF lesson when all pages done; assignment percent recalc
- `apps/api/src/modules/learning/sequential-access.service.ts` *(new)*
- `apps/api/src/modules/learning/sequential-lessons.util.ts` *(new)*
- `apps/api/src/modules/learning/sequential-lessons.util.spec.ts` *(new)*
- `apps/api/src/modules/learning/dto/learner-lesson-progress.dto.ts` *(new)*
- `apps/api/src/modules/learning/dto/ingest-learning-events.dto.ts` — entity-id validation

### Frontend

- `apps/web/src/app/features/courses/course-editor-page.component.ts` — Course Content = ordered PDF/video lesson cards + add/edit/preview/delete + drag reorder
- `apps/web/src/app/features/learning/course-player-page.component.ts` — outline uses lesson titles; sequential lock; prev/next lesson; auto-complete PDF/video
- `apps/web/src/app/shared/components/video-player/video-player.component.ts` — pause playback when tab/window tracking is paused
- `apps/web/src/app/core/http/courses-api.service.ts` — course lesson APIs
- `apps/web/src/app/core/http/learning-api.service.ts` — learner lesson APIs
- `apps/web/src/app/core/models/domain.models.ts` — `LessonStatus`, `locked`, `videoCompletionPercent`
- `apps/web/src/app/shared/utils/sequential-lessons.util.ts` *(new)*
- `apps/web/src/app/shared/utils/sequential-lessons.util.spec.ts` *(new)*
- `apps/web/src/app/shared/utils/video-meta.util.ts` *(new)* — duration + file size for authoring
- `apps/web/src/app/shared/utils/video-meta.util.spec.ts` *(new)*

PDF reader/timer/watermark/fullscreen files were **not** rewritten. The existing `PdfPageReadingEngine` and PDF viewer remain the source of truth (`PDF_PAGE_REQUIRED_SECONDS` stays **60**).

## Database changes

Reused existing `Course` → `CourseModule` → `Lesson` + `MediaAsset` + `LessonProgress` + `PageProgress`. No duplicate lesson tables.

| Change | Detail |
| --- | --- |
| Enum `LessonStatus` | `DRAFT`, `PUBLISHED` |
| Column `lessons.status` | `NOT NULL DEFAULT PUBLISHED` |
| Index | `lessons_status_idx` |

Existing FKs/indexes kept: `moduleId`, `contentMediaId`, `(moduleId, sortOrder)`.

Authoring creates lessons on a single primary module titled **Course Content** (created if missing). `sortOrder` is 0-based and rewritten on reorder.

## API changes

Existing module lesson routes remain. Course-scoped and learner routes added using current `/courses/...` and `/learning/...` conventions.

### Admin (roles: SUPER_ADMIN / ADMIN)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/courses/{courseId}/lessons` | Ordered course lessons |
| POST | `/courses/{courseId}/lessons` | Create lesson on primary module |
| PATCH | `/courses/lessons/{lessonId}` | Update lesson |
| DELETE | `/courses/lessons/{lessonId}` | Soft delete |
| POST | `/courses/{courseId}/lessons/reorder` | Reorder all course lessons (`SortOrder` 0..n-1) |
| GET | `/courses/lessons/{lessonId}` | Single lesson |
| POST | `/courses/modules/{moduleId}/lessons/reorder` | Existing module reorder (still valid) |

### Learner (enrolled employee)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/learner/courses/{courseId}/lessons` | Lessons + lock state |
| GET | `/learner/lessons/{lessonId}/progress` | Progress (must be accessible) |
| POST | `/learner/lessons/{lessonId}/progress` | Persist video/resume |
| POST | `/learner/lessons/{lessonId}/complete` | Complete current accessible lesson |
| GET | `/learning/assignments/{id}/player` | Player payload now includes `locked` + `videoCompletionPercent` |

`POST .../complete` does **not** blindly mark complete. Backend checks enrollment, lesson belongs to the assigned course, previous lesson completed, PDF pages finished (timer-backed), or video watch % ≥ 90.

## UI changes

### Admin Course Authoring → Content

Removed the Introduction / Assessment / Completion authoring layout.

Now:

- **Course content**
- **+ Add Lesson** modal: title, description, type PDF | Video, upload, detected page count / duration + size, preview, save
- Ordered cards: index, title, `PDF · N pages` / `Video · N min`, Edit / Preview / Delete
- Drag-and-drop reorder persisted via course reorder API

Publish readiness requires at least one PDF or video lesson with attached media.

### Employee player

- Course Outline drawer lists **lesson titles** (never PDF filenames)
- Icons: completed ✓, current, locked 🔒
- Meta: page count or duration
- Previous / Next lesson; cannot jump to locked future lessons
- Sequential unlock only (complete previous lesson)
- Completing the last PDF page (server-validated timer) marks the lesson complete and unlocks the next
- Video: authenticated media URL, play/pause, resume position, blur/tab pause, complete at 90% watch (server-validated)

## Security changes

- Never trust client `LESSON_COMPLETED` ingest for PDF
- `SequentialAccessService` shared by learning + page-progress (no circular module deps)
- Page heartbeats and complete-page reject locked future lessons
- Event ingest rejects events for locked lessons or lessons outside the enrolled course
- Media type validated on create/update/publish (`DOCUMENT` for PDF, `VIDEO` for video)
- Completion thresholds enforced server-side (`VIDEO_COMPLETION_PERCENT`, per-page required seconds)
- Quiz lessons are excluded from the learner sequence so incomplete quizzes cannot block this phase

## Tests executed

| Suite | Result |
| --- | --- |
| `npx prisma generate` + `migrate deploy` | Applied `20260810040000_lesson_status` |
| API Jest (`apps/api`) | **11 passed** (3 suites) — sequential unlock + existing auth/quiz-rules |
| API `tsc -p tsconfig.build.json --noEmit` | Pass |
| API `nest build` | Pass |
| Web Karma (`ng test --watch=false --browsers=ChromeHeadless`) | **10 passed** (app + sequential util + video-meta). Karma process hung on an Electron disconnect warning after SUCCESS; tests themselves passed |
| Shared `tsc` build | Pass |
| Web production `ng build` | Pass (includes template typecheck) |

Manual checklist (1–15) is covered by the implementation paths above; full click-through in a browser was not automated in this phase.

## Remaining issues

1. Quizzes / assessments are intentionally **not** built. Existing `LessonType.QUIZ` rows stay in the DB but are hidden from the employee sequence.
2. PDF required reading time remains **60 seconds/page** (`PDF_PAGE_REQUIRED_SECONDS`). Spec mentioned 90s; existing compliance timer was left unchanged.
3. Admin `GET /lessons/{id}` is exposed as `GET /courses/lessons/{id}` to match existing Nest controller mounting.
4. Frontend Karma may hang after green runs when Cursor Electron attaches as a second browser; exit code can look noisy despite `TOTAL: 10 SUCCESS`.
5. No Playwright/e2e coverage yet for create → reorder → employee sequential unlock.

## Recommended next step

Implement **quizzes as optional lessons in the same ordered sequence** (not a separate course structure): question authoring, server-graded submit, sequential unlock after quiz pass, without changing PDF timer or video threshold behavior.
