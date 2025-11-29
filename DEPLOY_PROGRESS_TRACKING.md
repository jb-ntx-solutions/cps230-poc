# Deploy Progress Tracking & Cancel Feature

This guide covers deploying the progress tracking and sync cancellation features.

## What's New

✅ **Progress Tracking**: Shows "Processed X of Y processes" with a visual progress bar
✅ **Cancel Sync**: Ability to stop a running sync job
✅ **Real-time Updates**: Progress updates every 2 seconds while sync is running

## Step 1: Apply Database Migrations (3 minutes)

### Migration 1: Add Progress Fields

1. **Open Supabase SQL Editor**:
   https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new

2. **Copy the migration SQL**:
   - Open: `supabase/migrations/20250129_add_sync_progress.sql`
   - Select all (Cmd+A) and copy (Cmd+C)

3. **Paste and run**:
   - Paste into the SQL Editor
   - Click **RUN**
   - Wait for "Success" message

### Migration 2: Add RLS Policies for Cancellation

1. **Open a new SQL query** (or clear the existing one)

2. **Copy the RLS migration SQL**:
   - Open: `supabase/migrations/20250129_add_sync_history_rls.sql`
   - Select all (Cmd+A) and copy (Cmd+C)

3. **Paste and run**:
   - Paste into the SQL Editor
   - Click **RUN**
   - Wait for "Success" message

   **Important**: This migration adds the necessary RLS policies for users to cancel their own syncs.

## Step 2: Redeploy Edge Function (3 minutes)

The Edge Function has been updated with:
- Progress tracking (updates `processed_count` after each process)
- Cancellation support (checks for `status='cancelled'` every iteration)
- Total process count tracking

**Deploy the updated function**:

1. Go to: https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/functions
2. Click on `sync-process-manager`
3. Copy all code from `supabase/functions/sync-process-manager/index.ts`
4. Paste into the function editor (replace existing code)
5. Click **Deploy**
6. Wait for "Deployed successfully"

## Step 3: Test It! (2 minutes)

1. **Refresh your browser** to load the updated UI code

2. **Go to Settings → Nintex Process Manager**

3. **Start a sync**:
   - Click **Sync Now**
   - You should see:
     - "Sync in progress..." message
     - "Processed X of Y processes" counter
     - Blue progress bar showing percentage
     - **Cancel Sync** button (red)

4. **Test cancellation** (optional):
   - Click **Cancel Sync** button
   - The sync should stop within a few seconds
   - Check Sync History - status should show "cancelled" with an orange icon

5. **Check Sync History**:
   - Scroll down to the Sync History panel
   - You should see progress counts for in-progress syncs
   - Completed syncs show total records synced

## What Changed

### Database (`sync_history` table)
```sql
ALTER TABLE sync_history
ADD COLUMN total_processes INTEGER DEFAULT 0,
ADD COLUMN processed_count INTEGER DEFAULT 0;
```

### Edge Function
- Sets `total_processes` after fetching all processes from PM
- Updates `processed_count` after each process is examined
- Checks for `status='cancelled'` in every loop iteration
- Exits gracefully when cancelled

### Frontend
**New Hooks**:
- `useCancelSync()` - mutation to set sync status to 'cancelled'

**UI Updates** ([src/pages/Settings.tsx](src/pages/Settings.tsx)):
- Progress indicator showing "Processed X of Y"
- Visual progress bar
- Cancel Sync button (appears when sync is running)
- Status icon for cancelled syncs (orange X)

**TypeScript Types** ([src/types/database.ts](src/types/database.ts)):
- Added `total_processes` and `processed_count` to `SyncHistory` type

## How It Works

### Progress Tracking
1. Edge Function fetches all processes from PM (may be 1000+)
2. Sets `total_processes = allProcesses.length`
3. For each process:
   - Fetches process details
   - Increments `processed_count`
   - Updates database
4. Frontend polls `sync_history` every 2 seconds
5. UI displays progress: `processed_count / total_processes`

### Cancellation
1. User clicks "Cancel Sync" button
2. Frontend updates `sync_history.status = 'cancelled'`
3. Edge Function checks status in every loop iteration
4. When `status === 'cancelled'`:
   - Stops processing
   - Sets `completed_at` timestamp
   - Exits gracefully
5. UI shows sync as "cancelled" in history

## Troubleshooting

### Progress not updating
- Check Edge Function logs for errors
- Verify migration ran successfully (check `sync_history` columns)
- Ensure browser is polling (check Network tab for requests every 2s)

### Cancel button doesn't work
- Check browser console for errors
- Verify RLS policies allow updates to `sync_history`
- Check Edge Function logs - should show "Sync cancelled by user"

### Progress bar stuck at 0%
- Edge Function may still be fetching the full process list
- Large PM sites (1000+ processes) may take 10-30 seconds to fetch all
- Once `total_processes` is set, progress will start showing

## Performance Optimizations

The Edge Function has been optimized for large datasets (1000+ processes):

### Progress Updates
- Updates every **5 processes** instead of every single process
- Reduces database writes by 80%
- For 1000 processes: ~200 progress updates vs 1000
- Provides smooth, responsive progress tracking

### Cancellation Checks
- Checks for cancellation every **5 processes** instead of every iteration
- Checks on first iteration for immediate responsiveness
- Reduces database reads by 80% while maintaining quick cancellation
- Cancellation detected within ~2-5 seconds

### Error Handling
- Individual process failures no longer halt entire sync
- Failed processes are logged and skipped
- Sync continues with remaining processes
- Total processed count includes failed processes

### Rate Limiting
- 50ms delay between processes (reduced from 100ms)
- Faster sync times while still respecting API limits
- For 1000 processes: saves ~50 seconds

### Expected Performance
- **Small datasets** (1-100 processes): 1-2 minutes
- **Medium datasets** (100-500 processes): 2-10 minutes
- **Large datasets** (500-1000+ processes): 10-30 minutes
- Progress bar updates smoothly throughout
