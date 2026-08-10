# Lesson Assessment Implementation Report

Phase 2: optional **per-lesson assessment**. Certificates, achievements, extra question types, and PDF/video timer changes were not implemented.

## Architecture changes

Assessments reuse the existing `Quiz` / `QuizQuestion` / `QuizOption` / `QuizAttempt` tables (1:0..1 on `Lesson`). No duplicate `Assessment2` tables.

Product language is **Assessment**. Storage remains `quizzes*` for compatibility.

Flow:

```
Lesson (PDF/Video)
  optional Assessment
    Questions (MCQ single-answer)
      Options
    Attempts (per enrolled employee)
```

Sequential unlock now requires:

- previous **lesson completed**
- **and** previous **assessment passed** when one is published

A lesson with no assessment still unlocks the next lesson on completion alone.

Employee APIs never return `isCorrect` until after submit, and only then if the admin enabled “Show correct answers after submit”. Score and pass/fail are computed on the server.

## Database changes

Migration: `apps/api/prisma/migrations/20260810050000_lesson_assessments`

| Change | Detail |
| --- | --- |
| Enum `QuizStatus` | `DRAFT`, `PUBLISHED` |
| `quizzes.status` | default `DRAFT` |
| `quizzes.show_correct_answers` | default `false` |
| `quizzes.passing_score` default | `80` |
| `quizzes.shuffle_questions` default | `false` |
| `quiz_questions.explanation` | optional text |
| Indexes | `quizzes_status_idx`, `quizzes_deleted_at_idx` |

Existing FKs kept: `Quiz.lessonId` unique, attempts tied to `CourseAssignment` + `User`.

## API changes

Admin (SUPER_ADMIN / ADMIN):

| Method | Path |
| --- | --- |
| POST | `/lessons/{lessonId}/assessment` |
| GET | `/lessons/{lessonId}/assessment` (includes correct answers) |
| PUT | `/lessons/{lessonId}/assessment` (replace bank + publish/draft) |
| GET/PATCH/DELETE | `/assessments/{assessmentId}` |
| POST | `/assessments/{id}/questions` |
| PATCH/DELETE | `/assessments/{id}/questions/{questionId}` |
| POST | `/assessments/{id}/questions/reorder` |

Legacy `/lessons/{id}/quiz` aliases still work.

Learner:

| Method | Path |
| --- | --- |
| GET | `/learner/lessons/{lessonId}/assessment` |
| POST | `/learner/lessons/{lessonId}/assessment/start` |
| POST | `/learner/assessment-attempts/{attemptId}/submit` |
| GET | `/learner/assessment-attempts/{attemptId}/result` |
| GET | `/learner/lessons/{lessonId}/assessment/attempts` |

Player payload (`GET /learning/assignments/{id}/player`) now includes `assessment` per lesson (`state`, counts, last score) with **no correct answers**.

Course publish fails if a lesson has a draft/invalid assessment.

## Frontend changes

- Course Authoring → Content: nested assessment block on each lesson card (`Add Assessment` / questions · pass % / Edit · Preview · Delete)
- Assessment editor: title, passing score, max attempts, show-answers toggle, MCQ 2–6 options, exactly one correct, optional explanation, reorder, save draft / publish with validation
- Employee outline: assessment nested under its lesson (Start / Not passed / Attempts exhausted / Locked)
- Focused assessment runner: one question at a time, Previous / Next / Submit, result screen (score, passing score, correct/incorrect counts, attempt, Try again / Continue)
- Sequential util updated on web + API

PDF timer, watermark, fullscreen, and video tracking were not changed.

## Security implementation

- Enrollment + lesson-in-course + sequential gate before start/submit
- Lesson must be `COMPLETED` before assessment start
- Attempt cap enforced; passed assessments cannot be restarted
- All questions required on submit; duplicates rejected
- Server-side scoring (`scorePercent` / `isAssessmentPassing`)
- Correct options stripped from learner start payload
- Passing an assessment does **not** trust a client flag and does **not** mark the lesson complete (lesson is already complete)
- Audit: `ASSESSMENT_CREATED/UPDATED/DELETED`, `QUESTION_CREATED/UPDATED/DELETED`, `ASSESSMENT_STARTED/SUBMITTED/PASSED/FAILED`

## Tests executed

| Check | Result |
| --- | --- |
| Prisma generate + migrate deploy | Applied `20260810050000_lesson_assessments` |
| API Jest | **19 passed** |
| API `tsc --noEmit` + `nest build` | Pass |
| Shared `tsc --noEmit` | Pass |
| Web Karma ChromeHeadless | **6 passed** |
| Web production `ng build` | Pass |

## Remaining issues

1. Only multiple-choice single-answer is implemented (by design).
2. Assessments must be **published** to appear for employees and to allow course publish.
3. Existing unused `quiz-runner` / `quiz-bank-editor` components remain in the repo (player/authoring use the new assessment components).
4. No Playwright e2e for the 20-step manual checklist.
5. Reports “quiz analytics” tab still uses older quiz wording; not part of this phase.

## Next recommended phase

Either **True/False + multiple-select question types**, or a **reports/analytics** pass for assessment pass rates — still without certificates or gamification.
