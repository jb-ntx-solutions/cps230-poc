-- Add RLS policies for sync_history table to allow cancellation

-- Enable RLS if not already enabled
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view sync history for their account" ON sync_history;
DROP POLICY IF EXISTS "Users can update sync history for their account" ON sync_history;
DROP POLICY IF EXISTS "Promasters can insert sync history" ON sync_history;

-- Policy: Users can view sync history for their account
CREATE POLICY "Users can view sync history for their account"
ON sync_history
FOR SELECT
USING (
    account_id IN (
        SELECT account_id FROM user_profiles WHERE user_id = auth.uid()
    )
);

-- Policy: Promasters can update sync history (for cancellation)
CREATE POLICY "Users can update sync history for their account"
ON sync_history
FOR UPDATE
USING (
    account_id IN (
        SELECT account_id FROM user_profiles WHERE user_id = auth.uid()
    )
);

-- Policy: Promasters can insert sync history
CREATE POLICY "Promasters can insert sync history"
ON sync_history
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND role = 'promaster'
        AND account_id = sync_history.account_id
    )
);
