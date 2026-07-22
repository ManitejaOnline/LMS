# Phase 3 — Course Management

## Scope delivered

- Course CRUD with Draft / Published / Archived
- Modules + lessons with drag-drop reorder APIs + Angular CDK UI
- Lesson types: PDF, Video, Quiz placeholder (no quiz engine)
- Media upload: thumbnail, PDF, video (local storage)
- Assignment rules (department / employee / all)
- Validation + audit logging
- Admin Angular screens; employees cannot access course admin

## Explicitly excluded

- Progress tracking
- Quiz engine
- Assignment execution / enrollment engine

## Admin UI routes

- `/app` — dashboard with course stats (admin)
- `/app/courses` — course list
- `/app/courses/new` — create
- `/app/courses/:id` — edit + lesson builder + rules

## Apply migration

```bash
npm run prisma:migrate:deploy -w @zebl/api
```
