-- Add fields to track resume position and processed processes
ALTER TABLE sync_history
ADD COLUMN IF NOT EXISTS last_processed_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processed_pm_ids INTEGER[] DEFAULT '{}';

COMMENT ON COLUMN sync_history.last_processed_index IS 'Index of last successfully processed process (for resume)';
COMMENT ON COLUMN sync_history.processed_pm_ids IS 'Array of PM process IDs that have been successfully processed';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sync_history_status_started
ON sync_history (status, started_at DESC)
WHERE status IN ('in_progress', 'failed');
