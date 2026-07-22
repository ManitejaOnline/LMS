-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "LessonType" AS ENUM ('PDF', 'VIDEO', 'QUIZ');
CREATE TYPE "MediaKind" AS ENUM ('THUMBNAIL', 'DOCUMENT', 'VIDEO');
CREATE TYPE "AssignmentRuleTargetType" AS ENUM ('ALL_EMPLOYEES', 'DEPARTMENT', 'EMPLOYEE');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "estimated_minutes" INTEGER,
    "thumbnail_media_id" TEXT,
    "created_by_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "course_modules" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "LessonType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "content_media_id" TEXT,
    "duration_seconds" INTEGER,
    "quiz_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "course_assignment_rules" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "target_type" "AssignmentRuleTargetType" NOT NULL,
    "department_id" TEXT,
    "user_id" TEXT,
    "due_in_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "course_assignment_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");
CREATE INDEX "courses_status_idx" ON "courses"("status");
CREATE INDEX "courses_title_idx" ON "courses"("title");
CREATE INDEX "courses_deleted_at_idx" ON "courses"("deleted_at");
CREATE INDEX "course_modules_course_id_sort_order_idx" ON "course_modules"("course_id", "sort_order");
CREATE INDEX "course_modules_deleted_at_idx" ON "course_modules"("deleted_at");
CREATE INDEX "lessons_module_id_sort_order_idx" ON "lessons"("module_id", "sort_order");
CREATE INDEX "lessons_type_idx" ON "lessons"("type");
CREATE INDEX "lessons_deleted_at_idx" ON "lessons"("deleted_at");
CREATE INDEX "media_assets_kind_idx" ON "media_assets"("kind");
CREATE INDEX "media_assets_deleted_at_idx" ON "media_assets"("deleted_at");
CREATE INDEX "course_assignment_rules_course_id_idx" ON "course_assignment_rules"("course_id");
CREATE INDEX "course_assignment_rules_target_type_idx" ON "course_assignment_rules"("target_type");
CREATE INDEX "course_assignment_rules_deleted_at_idx" ON "course_assignment_rules"("deleted_at");

ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_thumbnail_media_id_fkey" FOREIGN KEY ("thumbnail_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_content_media_id_fkey" FOREIGN KEY ("content_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "course_assignment_rules" ADD CONSTRAINT "course_assignment_rules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_assignment_rules" ADD CONSTRAINT "course_assignment_rules_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "course_assignment_rules" ADD CONSTRAINT "course_assignment_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
