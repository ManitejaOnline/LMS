# Learning Programs, Levels & Certification — Implementation Report

Phase 3 adds a progression layer **above** existing Course → Lesson → optional Lesson Assessment. Courses are referenced, not copied. Lesson completion, PDF timer, watermark, fullscreen, video tracking, and lesson-assessment scoring were not rewritten.

## Architecture

```
LearningProgram
  └── LearningLevel (sortOrder → Level 1, 2, 3…; optional one Final Level)
        └── LevelCourse → existing Course
              └── Lessons → optional Lesson Assessment
        └── Final Assessment (Quiz owned by level, not a lesson)
              └── Certificate (after full program completion)
```

- **Program** is assignable as a whole (All Employees / Department / Role / Specific Employees).
- **Level 1** is available on assignment. Later levels unlock only when the previous level is complete.
- **Course completion** uses existing lesson completion + published lesson assessments (must be passed).
- **Level completion (MVP):** all required courses complete. Final level also requires a passed final assessment.
- **Certificate** is issued only when every level is complete. Eligibility is never trusted from the client.

## Database changes

Migration: `apps/api/prisma/migrations/20260810060000_learning_programs`

New enums: `ProgramStatus`, `ProgramEnrollmentStatus`, `LevelProgressStatus`, `LevelCompletionRule` (`ALL_REQUIRED` only).

New tables:

- `learning_programs`
- `learning_levels`
- `level_courses` (unique `levelId + courseId`)
- `program_enrollments` (unique `programId + userId`)
- `level_progress`
- `program_certificates`

Quiz reuse:

- `quizzes.lesson_id` is now optional; `quizzes.level_id` unique optional.
- CHECK `quizzes_owner_chk`: exactly one of `lesson_id` | `level_id` unless soft-deleted.
- `quiz_attempts.assignment_id` optional; `enrollment_id` for final-level attempts.
- Unique attempt key: `(quizId, userId, attemptNumber)`.

Course assignment:

- `course_assignments.program_enrollment_id` optional. Program assign creates assignments when missing; standalone assignments stay directly accessible.

## API changes

Admin (`SUPER_ADMIN`, `ADMIN`):

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/programs` | List / create |
| GET/PATCH/DELETE | `/programs/:id` | Get / update / archive-delete |
| PATCH | `/programs/:id/status` | Draft / publish / archive |
| POST | `/programs/:id/levels` | Add level |
| POST | `/programs/:id/levels/reorder` | Drag-and-drop order |
| PATCH/DELETE | `/levels/:id` | Edit / delete |
| POST | `/levels/:id/courses` | Add published courses |
| POST | `/levels/:id/courses/reorder` | Reorder courses |
| PATCH/DELETE | `/level-courses/:id` | Required flag / remove |
| POST | `/programs/:id/assignments` | Assign whole program |
| POST/GET/PUT | `/levels/:id/assessment` | Final-level quiz bank |

Learner:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/learner/programs` | Enrolled programs + level summaries (no course dump) |
| GET | `/learner/programs/:id` | Program page: levels only |
| GET | `/learner/programs/:id/levels/:levelId` | Selected level + that level's courses only |
| GET | `/learner/programs/:id/certificate` | Certificate JSON (completed only) |
| GET | `/learner/programs/:id/certificate.html` | Downloadable HTML |
| GET/POST | `/learner/programs/:id/final-assessment` | Summary / start |
| POST | `/learner/assessment-attempts/:id/submit` | Same scoring engine |

Publish is blocked unless: name ≥ 3 chars, ≥ 1 level, every level has ≥ 1 required course, at most one final level, and a final level has a published valid assessment.

## Admin UI

- Nav: **Learning Programs**
- List + editor (`/app/programs`, `/app/programs/:id`)
- Create / edit / archive / publish
- Levels with drag-and-drop; numbers come from `sortOrder`
- Add existing **published** courses; search name/code; default Required; no duplicates in a level
- One Final Level + Configure (reuses question-bank editor)
- Publish readiness panel
- Assign wizard (same scopes as course assign)

## Employee UI

Navigation is **Program → Level list → selected Level → courses in that level → course player**. Courses are not flattened onto the program page.

- **My Learning** (`/app/my-learning`): assigned programs with overall progress and **level cards only** (`Open Level`). Standalone courses stay in a separate list (`programEnrollmentId` filter).
- **Program page** (`/app/learning/programs/:programId`): program info, overall progress, level cards. No course dump.
- **Level page** (`/app/learning/programs/:programId/levels/:levelId`): only `LevelCourse` rows for that `levelId`. Locked levels still open, show 🔒 courses, and never expose Start/Continue.
- Level Complete modal (no XP / badges / streaks).
- Final assessment remains on the final level screen when unlocked.
- Certificate view + HTML download only after completion.

Mobile: level cards stack vertically, ≥44px targets, no horizontal scroll required.

## Unlock logic

Computed server-side in `ProgramProgressService.evaluate`:

1. Level 0 is unlocked.
2. Level N unlocks only if level N−1 is complete.
3. Non-final complete = all required courses have `AssignmentStatus.COMPLETED`.
4. Final complete = required courses complete **and** published final quiz passed.
5. `currentLevelId` is denormalized after evaluate; it is never trusted as an input.

## Security enforcement

- `requireOwnedAssignment` / `requireEnrollment` call `assertCourseAccessible` when the assignment is program-linked and the level is locked → `403`.
- Final assessment start/submit call `assertFinalAssessmentAccessible`.
- Certificate endpoints require enrollment `COMPLETED` + issued row.
- There is no API to set `currentLevelId`, mark a level complete, or request a certificate early.
- Scoring remains server-side; correct options are not sent to learners unless configured.

## Certificate implementation

Issued inside `syncEnrollment` when all levels become complete:

- Employee name, program name, completion date (`issuedAt`), certificate ID (`ZBL-…`), organization (`ORGANIZATION_NAME` or `Zebl`).
- HTML download via authenticated blob request.

## Tests executed

| Check | Result |
| --- | --- |
| API Jest (`27` tests, including `learner-level.view.spec.ts`) | Pass |
| API `tsc --noEmit -p tsconfig.build.json` | Pass |
| `nest build` | Pass |
| Angular Karma ChromeHeadless (`10` tests) | Pass |
| Shared `tsc --noEmit` | Pass |
| `ng build` production | Pass |

Manual E2E checklist items 1–26 were implemented in code paths; automated coverage is unit-level (unlock/publish rules + frontend helpers). Full browser walkthrough (create → assign → sequential unlock → final exam → certificate) should still be run against local admin/employee accounts.

## Remaining issues

- `tsc` on full `apps/api/tsconfig.json` still reports pre-existing `test/app.e2e-spec.ts` Fastify import (excluded from nest build).
- Program thumbnail upload UI was left optional/unimplemented (schema supports `thumbnailMediaId`).
- `LevelCompletionRule` is future-ready (`ALL_REQUIRED` only in UI).
- Nest `--watch` was stopped briefly so Prisma could replace the Windows query engine DLL; restart `npm run dev:api` if the API is down.
- Independent multi-employee progress is enforced by enrollment rows; not covered by an automated multi-user integration test.

## Next recommended phase

1. Manager/admin program progress report (who is on which level).
2. Optional program thumbnail + certificate branding.
3. Percentage / selected-count level completion rules (schema already allows extension).
4. Auto-assign programs to new hires via assignment rules (mirror course rules).
5. Playwright/e2e covering level lock bypass attempts.
