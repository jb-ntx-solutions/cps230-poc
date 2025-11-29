# Edge Function Timeout Issue

## The Problem

Your sync is getting stuck at ~440 out of 1077 processes because:

1. **Edge Functions have execution time limits**:
   - Free tier: ~10 minutes
   - Pro tier: ~30 minutes
   - Your 1077 processes are taking longer than the limit

2. **What happens at timeout**:
   - Function stops executing mid-process
   - No error is thrown (just silent failure)
   - Progress stops updating
   - Sync status stays "in_progress" forever

## Immediate Solutions

### Option 1: View Logs in Dashboard (Quick)

1. Go to: https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/functions/sync-process-manager/logs
2. Look for:
   - "Progress: XXX/1077" messages (will show where it stopped)
   - Any error messages before it stopped
   - Timeout errors

### Option 2: Reduce Process Count (Temporary)

Modify the Edge Function to only sync processes with CPS230 tag earlier in the flow:

```typescript
// After fetching all processes, filter early
const cps230Processes = []
for (const process of allProcesses) {
  const detail = await fetchProcessDetails(config, bearerToken, process.processUniqueId)
  if (hasCPS230Tag(detail)) {
    cps230Processes.push({ ...process, detail })
  }
  // Early exit if taking too long
  if (cps230Processes.length > 100) break
}
```

## Long-term Solutions

### Solution A: Batch Processing (Recommended)

Split sync into multiple smaller batches that each complete within timeout:

1. **First request**: Fetches process list, saves to database
2. **Subsequent requests**: Process 50-100 at a time
3. **UI**: Shows overall progress across batches

**Pros**: Reliable, handles any dataset size
**Cons**: More complex implementation

### Solution B: Incremental Sync

Only sync processes that changed since last sync:

1. Store `last_sync_timestamp`
2. Use PM API filters to get only updated processes
3. Much faster for regular syncs

**Pros**: Fast after initial sync
**Cons**: Initial sync still needs batching

### Solution C: Background Job Service

Use a long-running background service:

1. Deploy separate worker service (not Edge Function)
2. Edge Function just triggers the worker
3. Worker has no timeout limits

**Pros**: No timeouts, can run for hours
**Cons**: More infrastructure, costs more

## Quick Fix for Now

The simplest immediate fix is to **check the logs** and then **deploy the updated Edge Function** with better logging. This will at least show you exactly where and why it's failing.

### Check Logs

1. Go to Functions logs in dashboard
2. Find the latest "Progress:" message
3. Look for errors after that point

### Expected Log Output

```
Progress: 5/1077 processes examined, 2 with CPS230 tag
Progress: 10/1077 processes examined, 4 with CPS230 tag
...
Progress: 440/1077 processes examined, 180 with CPS230 tag
[Then either an error or nothing if it timed out]
```

If you see **no error** after the last progress message, it's definitely a timeout.

## Recommended Next Steps

1. **Check logs** to confirm timeout
2. **Implement batch processing** (I can help with this)
3. **Add timeout detection** so sync status gets updated to "failed" instead of stuck "in_progress"

Would you like me to implement the batch processing solution?
