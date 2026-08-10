-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "quizzes"
  ADD COLUMN "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "show_correct_answers" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "passing_score" SET DEFAULT 80,
  ALTER COLUMN "shuffle_questions" SET DEFAULT false;

-- AlterTable
ALTER TABLE "quiz_questions" ADD COLUMN "explanation" TEXT;

-- CreateIndex
CREATE INDEX "quizzes_status_idx" ON "quizzes"("status");

-- CreateIndex
CREATE INDEX "quizzes_deleted_at_idx" ON "quizzes"("deleted_at");
