-- MVP page reading timer: 90s → 60s (1 minute)

ALTER TABLE "page_progress" ALTER COLUMN "required_seconds" SET DEFAULT 60;

UPDATE "page_progress"
SET "required_seconds" = 60
WHERE "completed" = false AND "required_seconds" = 90;
