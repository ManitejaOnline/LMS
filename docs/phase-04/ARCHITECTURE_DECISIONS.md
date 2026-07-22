# Architecture Decisions — Phase 4 Learning Engine

## AD-40: Assignments materialize from rules or direct assign

`CourseAssignment` is the learner enrollment record. Rules remain declarative; **Assign to learners** calls `apply-rules` to create/upsert assignment rows for target users.

## AD-41: Event batch ingest with clientEventId idempotency

Frontend queues tracker events and flushes in batches. Duplicate `clientEventId` is ignored (unique constraint).

## AD-42: Progress derived from lesson completion + content heuristics

PDF auto-completes at ≥95% scroll; video at ≥90% watch. Quiz lessons are not auto-completed (engine later). Course `%` = completed lessons / total lessons.

## AD-43: Player layout is fixed composition

Left lessons / Center viewer / Right progress / Bottom prev-next — spacing and responsiveness only; no redesign.

## AD-44: Overdue is derived, not a fourth status

Statuses remain Not Started / In Progress / Completed per spec. UI may show Overdue badge when `dueAt < now` and not completed.
