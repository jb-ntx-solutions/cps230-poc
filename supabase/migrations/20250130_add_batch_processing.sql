-- Add batch processing support to sync_history table

ALTER TABLE sync_history
ADD COLUMN IF NOT EXISTS current_batch INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_batches INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 100;

-- Add comment explaining the fields
COMMENT ON COLUMN sync_history.current_batch IS 'Current batch being processed (1-indexed)';
COMMENT ON COLUMN sync_history.total_batches IS 'Total number of batches for this sync';
COMMENT ON COLUMN sync_history.batch_size IS 'Number of processes per batch';
