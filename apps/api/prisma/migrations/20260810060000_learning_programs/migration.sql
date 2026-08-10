-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ProgramEnrollmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "LevelProgressStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'COMPLETED');
CREATE TYPE "LevelCompletionRule" AS ENUM ('ALL_REQUIRED');

CREATE TABLE "learning_programs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "thumbnail_media_id" TEXT,
    "created_by_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "learning_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning_levels" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "completion_rule" "LevelCompletionRule" NOT NULL DEFAULT 'ALL_REQUIRED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "learning_levels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "level_courses" (
    "id" TEXT NOT NULL,
    "level_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "level_courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "program_enrollments" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ProgramEnrollmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "current_level_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "program_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "level_progress" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "level_id" TEXT NOT NULL,
    "status" "LevelProgressStatus" NOT NULL DEFAULT 'LOCKED',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "level_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "program_certificates" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "certificate_code" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "program_name" TEXT NOT NULL,
    "organization_name" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "program_certificates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "quizzes" ALTER COLUMN "lesson_id" DROP NOT NULL;
ALTER TABLE "quizzes" ADD COLUMN "level_id" TEXT;
CREATE UNIQUE INDEX "quizzes_level_id_key" ON "quizzes"("level_id");
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "learning_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_owner_chk" CHECK (
  ("deleted_at" IS NOT NULL) OR
  (("lesson_id" IS NOT NULL AND "level_id" IS NULL) OR ("lesson_id" IS NULL AND "level_id" IS NOT NULL))
);

ALTER TABLE "course_assignments" ADD COLUMN "program_enrollment_id" TEXT;

ALTER TABLE "quiz_attempts" ALTER COLUMN "assignment_id" DROP NOT NULL;
ALTER TABLE "quiz_attempts" ADD COLUMN "enrollment_id" TEXT;
DROP INDEX IF EXISTS "quiz_attempts_quiz_id_assignment_id_attempt_number_key";
CREATE UNIQUE INDEX "quiz_attempts_quiz_id_user_id_attempt_number_key" ON "quiz_attempts"("quiz_id", "user_id", "attempt_number");

ALTER TABLE "learning_programs" ADD CONSTRAINT "learning_programs_thumbnail_media_id_fkey" FOREIGN KEY ("thumbnail_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_programs" ADD CONSTRAINT "learning_programs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_levels" ADD CONSTRAINT "learning_levels_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "learning_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "level_courses" ADD CONSTRAINT "level_courses_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "learning_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "level_courses" ADD CONSTRAINT "level_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "learning_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_current_level_id_fkey" FOREIGN KEY ("current_level_id") REFERENCES "learning_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "level_progress" ADD CONSTRAINT "level_progress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "program_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "level_progress" ADD CONSTRAINT "level_progress_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "learning_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_certificates" ADD CONSTRAINT "program_certificates_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "program_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_assignments" ADD CONSTRAINT "course_assignments_program_enrollment_id_fkey" FOREIGN KEY ("program_enrollment_id") REFERENCES "program_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "program_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "learning_programs_status_idx" ON "learning_programs"("status");
CREATE INDEX "learning_programs_name_idx" ON "learning_programs"("name");
CREATE INDEX "learning_programs_deleted_at_idx" ON "learning_programs"("deleted_at");
CREATE INDEX "learning_levels_program_id_sort_order_idx" ON "learning_levels"("program_id", "sort_order");
CREATE INDEX "learning_levels_deleted_at_idx" ON "learning_levels"("deleted_at");
CREATE UNIQUE INDEX "level_courses_level_id_course_id_key" ON "level_courses"("level_id", "course_id");
CREATE INDEX "level_courses_level_id_sort_order_idx" ON "level_courses"("level_id", "sort_order");
CREATE INDEX "level_courses_course_id_idx" ON "level_courses"("course_id");
CREATE UNIQUE INDEX "program_enrollments_program_id_user_id_key" ON "program_enrollments"("program_id", "user_id");
CREATE INDEX "program_enrollments_user_id_status_idx" ON "program_enrollments"("user_id", "status");
CREATE INDEX "program_enrollments_program_id_idx" ON "program_enrollments"("program_id");
CREATE INDEX "program_enrollments_deleted_at_idx" ON "program_enrollments"("deleted_at");
CREATE UNIQUE INDEX "level_progress_enrollment_id_level_id_key" ON "level_progress"("enrollment_id", "level_id");
CREATE INDEX "level_progress_level_id_idx" ON "level_progress"("level_id");
CREATE UNIQUE INDEX "program_certificates_enrollment_id_key" ON "program_certificates"("enrollment_id");
CREATE UNIQUE INDEX "program_certificates_certificate_code_key" ON "program_certificates"("certificate_code");
CREATE INDEX "course_assignments_program_enrollment_id_idx" ON "course_assignments"("program_enrollment_id");
CREATE INDEX "quiz_attempts_enrollment_id_idx" ON "quiz_attempts"("enrollment_id");
