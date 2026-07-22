# API Documentation — Phase 5 additions

Interactive OpenAPI: `/api/docs` (development).

## Quiz

| Method | Path | Roles | Notes |
|---|---|---|---|
| PUT | `/api/v1/lessons/:lessonId/quiz` | SUPER_ADMIN, ADMIN | Upsert question bank |
| GET | `/api/v1/lessons/:lessonId/quiz` | SUPER_ADMIN, ADMIN | Bank with answers |
| POST | `/api/v1/learning/assignments/:assignmentId/lessons/:lessonId/quiz/start` | Authenticated owner | Randomized attempt |
| POST | `/api/v1/learning/quiz-attempts/:attemptId/submit` | Authenticated owner | Score + pass/fail |
| GET | `/api/v1/learning/assignments/:assignmentId/lessons/:lessonId/quiz/attempts` | Authenticated owner | Attempt history |

## Reports

| Method | Path | Roles |
|---|---|---|
| GET | `/api/v1/reports/admin-dashboard` | SUPER_ADMIN, ADMIN |
| GET | `/api/v1/reports/manager-dashboard` | SUPER_ADMIN, ADMIN, MANAGER |
| GET | `/api/v1/reports/course-completion` | SUPER_ADMIN, ADMIN, MANAGER |
| GET | `/api/v1/reports/employee-progress` | SUPER_ADMIN, ADMIN, MANAGER |
| GET | `/api/v1/reports/reading-time` | SUPER_ADMIN, ADMIN, MANAGER |
| GET | `/api/v1/reports/video-analytics` | SUPER_ADMIN, ADMIN, MANAGER |
| GET | `/api/v1/reports/quiz-analytics` | SUPER_ADMIN, ADMIN, MANAGER |
| GET | `/api/v1/reports/audit-logs` | SUPER_ADMIN, ADMIN |

## Notifications

| Method | Path | Roles |
|---|---|---|
| GET | `/api/v1/notifications` | Authenticated |
| GET | `/api/v1/notifications/unread-count` | Authenticated |
| POST | `/api/v1/notifications/:id/read` | Authenticated owner |
| POST | `/api/v1/notifications/read-all` | Authenticated |

Envelope remains `{ success, data|error, timestamp, path, requestId }`.
