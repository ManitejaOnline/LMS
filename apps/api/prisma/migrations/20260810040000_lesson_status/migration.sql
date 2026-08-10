-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN "status" "LessonStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateIndex
CREATE INDEX "lessons_status_idx" ON "lessons"("status");
