-- 0048_bug_reports_screenshot.sql — Add optional screenshot path to bug reports (H9-2)

ALTER TABLE bug_reports
  ADD COLUMN IF NOT EXISTS screenshot_path TEXT;
