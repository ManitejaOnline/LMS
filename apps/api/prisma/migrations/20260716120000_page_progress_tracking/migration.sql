-- Compliance PDF page reading progress + tracking events

ALTER TYPE "LearningEventType" ADD VALUE IF NOT EXISTS 'PAGE_STARTED';
ALTER TYPE "LearningEventType" ADD VALUE IF NOT EXISTS 'PAGE_COMPLETED';
ALTER TYPE "LearningEventType" ADD VALUE IF NOT EXISTS 'PAGE_PAUSED';
ALTER TYPE "LearningEventType" ADD VALUE IF NOT EXISTS 'PAGE_RESUMED';
ALTER TYPE "LearningEventType" ADD VALUE IF NOT EXISTS 'PAGE_CHANGED';
ALTER TYPE "LearningEventType" ADD VALUE IF NOT EXISTS 'IDLE';
ALTER TYPE "LearningEventType" ADD VALUE IF NOT EXISTS 'RETURNED';

CREATE TABLE "page_progress" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "required_seconds" INTEGER NOT NULL DEFAULT 90,
    "completed_seconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "pause_count" INTEGER NOT NULL DEFAULT 0,
    "total_paused_sec" INTEGER NOT NULL DEFAULT 0,
    "focus_lost_count" INTEGER NOT NULL DEFAULT 0,
    "tab_switch_count" INTEGER NOT NULL DEFAULT 0,
    "hidden_count" INTEGER NOT NULL DEFAULT 0,
    "idle_count" INTEGER NOT NULL DEFAULT 0,
    "last_heartbeat_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "page_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "page_progress_assignment_id_lesson_id_page_number_key"
  ON "page_progress"("assignment_id", "lesson_id", "page_number");
CREATE INDEX "page_progress_user_id_lesson_id_idx" ON "page_progress"("user_id", "lesson_id");
CREATE INDEX "page_progress_assignment_id_lesson_id_idx" ON "page_progress"("assignment_id", "lesson_id");

ALTER TABLE "page_progress"
  ADD CONSTRAINT "page_progress_assignment_id_fkey"
  FOREIGN KEY ("assignment_id") REFERENCES "course_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "page_progress"
  ADD CONSTRAINT "page_progress_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "page_progress"
  ADD CONSTRAINT "page_progress_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
