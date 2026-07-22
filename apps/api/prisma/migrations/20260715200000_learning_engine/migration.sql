CREATE TYPE "AssignmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "LessonProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "LearningEventType" AS ENUM (
  'LESSON_OPENED', 'LESSON_COMPLETED', 'READING_TIME', 'PAGE_VIEW', 'SCROLL', 'RESUME_POSITION',
  'VIDEO_PLAY', 'VIDEO_PAUSE', 'VIDEO_SEEK', 'VIDEO_SPEED', 'VIDEO_PROGRESS',
  'TAB_HIDDEN', 'TAB_VISIBLE', 'WINDOW_BLUR', 'WINDOW_FOCUS', 'IDLE_START', 'IDLE_END'
);

CREATE TABLE "course_assignments" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "due_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "last_lesson_id" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "course_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lesson_progress" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "LessonProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "current_page" INTEGER,
    "total_pages" INTEGER,
    "visited_pages" JSONB,
    "scroll_percentage" DOUBLE PRECISION,
    "resume_position_sec" DOUBLE PRECISION,
    "reading_time_sec" INTEGER NOT NULL DEFAULT 0,
    "watch_percentage" DOUBLE PRECISION,
    "idle_time_sec" INTEGER NOT NULL DEFAULT 0,
    "last_playback_speed" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_event_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning_events" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "lesson_id" TEXT,
    "user_id" TEXT NOT NULL,
    "event_type" "LearningEventType" NOT NULL,
    "payload" JSONB,
    "client_event_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_assignments_course_id_user_id_key" ON "course_assignments"("course_id", "user_id");
CREATE INDEX "course_assignments_user_id_status_idx" ON "course_assignments"("user_id", "status");
CREATE INDEX "course_assignments_course_id_idx" ON "course_assignments"("course_id");
CREATE INDEX "course_assignments_due_at_idx" ON "course_assignments"("due_at");
CREATE INDEX "course_assignments_deleted_at_idx" ON "course_assignments"("deleted_at");
CREATE UNIQUE INDEX "lesson_progress_assignment_id_lesson_id_key" ON "lesson_progress"("assignment_id", "lesson_id");
CREATE INDEX "lesson_progress_user_id_idx" ON "lesson_progress"("user_id");
CREATE INDEX "lesson_progress_lesson_id_idx" ON "lesson_progress"("lesson_id");
CREATE UNIQUE INDEX "learning_events_client_event_id_key" ON "learning_events"("client_event_id");
CREATE INDEX "learning_events_assignment_id_occurred_at_idx" ON "learning_events"("assignment_id", "occurred_at");
CREATE INDEX "learning_events_user_id_occurred_at_idx" ON "learning_events"("user_id", "occurred_at");
CREATE INDEX "learning_events_event_type_idx" ON "learning_events"("event_type");

ALTER TABLE "course_assignments" ADD CONSTRAINT "course_assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_assignments" ADD CONSTRAINT "course_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "course_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "course_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
