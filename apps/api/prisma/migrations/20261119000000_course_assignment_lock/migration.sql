-- AlterTable
ALTER TABLE "courses" ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "course_assignments" ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false;
