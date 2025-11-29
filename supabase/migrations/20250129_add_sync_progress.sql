-- Add progress tracking fields to sync_history table
ALTER TABLE sync_history
ADD COLUMN IF NOT EXISTS total_processes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processed_count INTEGER DEFAULT 0;

-- Add comment explaining the fields
COMMENT ON COLUMN sync_history.total_processes IS 'Total number of processes to sync';
COMMENT ON COLUMN sync_history.processed_count IS 'Number of processes processed so far';
