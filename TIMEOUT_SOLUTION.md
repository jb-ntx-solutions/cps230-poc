# Edge Function Timeout - Real Solution

## The Problem

Supabase Edge Functions have a **hard 10-minute timeout limit**. With 1077 processes:
- Each process takes ~1 second to fetch and save
- 1077 processes = ~18 minutes total
- This exceeds the 10-minute limit no matter how we batch

## What's Happening

The sync gets ~500-550 processes in before hitting the 10-minute wall and timing out silently.

## Solution Options

### Option 1: Manual Batching (Simplest - Recommended)

**Run multiple smaller syncs manually:**

1. Sync first 400 processes (takes ~7 minutes)
2. Wait for completion
3. Sync next 400 processes (takes ~7 minutes)
4. Wait for completion
5. Sync remaining 277 processes (takes ~5 minutes)

**How to implement:**
- Add a "start index" and "limit" parameter to the Edge Function
- UI has "Sync Next 400" button
- Each run processes 400, then stops
- After 3 runs, all 1077 are synced

**Pros**: Simple, works within timeout limits, you control when each batch runs
**Cons**: Requires 3 manual syncs for initial load

### Option 2: Incremental Sync (Best Long-term)

**Only sync processes that changed since last sync:**

1. Store `last_modified` timestamp for each process
2. On sync, use PM API filter: `modifiedAfter=<last_sync_time>`
3. Only fetch/update processes that actually changed
4. Much faster - usually <100 processes per sync

**Pros**: Fast ongoing syncs (1-2 minutes), handles any dataset size
**Cons**: Needs initial full sync (still hits timeout for 1077)

### Option 3: Pagination API (If PM Supports It)

**Fetch processes in pages directly from PM:**

If Process Manager API supports:
```
GET /processes?page=1&pageSize=400&tag=CPS230
```

Then we could:
1. Only fetch CPS230 processes (not all 1077)
2. Fetch in manageable chunks
3. Much faster

**Pros**: Only fetches what we need
**Cons**: Requires PM API to support filtering by tag

### Option 4: Separate Worker Service (Complex)

**Deploy a long-running worker outside Supabase:**

- Deploy to Railway, Render, or AWS Lambda (no timeout limits)
- Edge Function just triggers the worker
- Worker can run for hours if needed

**Pros**: No timeout limits ever
**Cons**: More infrastructure, costs more, complex

## Recommended Approach

**For your 1077 processes, I recommend a hybrid:**

### Phase 1: Initial Sync (One-time)
Use **Manual Batching**:
1. Modify Edge Function to accept `startIndex` and `limit` parameters
2. Run 3 syncs:
   - Sync 1: processes 0-400
   - Sync 2: processes 400-800
   - Sync 3: processes 800-1077

### Phase 2: Ongoing Syncs
Use **Incremental Sync**:
- Only sync processes modified since last sync
- Runs fast (<2 minutes typically)
- Handles ongoing changes easily

## Quick Fix for Now

The deployed version now:
1. **Detects approaching timeout** (at 8 minutes)
2. **Exits gracefully** with clear error message
3. **Shows exactly where it stopped**

Error message will say:
```
Timeout after processing 530 of 1077 processes.
Completed 5 of 11 batches.
```

You'll know exactly where it stopped and can:
1. Check logs to see last successful process
2. Note which processes were synced
3. Decide on next approach

## What I Can Implement

I can quickly implement **Manual Batching** (Option 1):
- Add `startIndex` and `limit` to Edge Function parameters
- Add UI controls: "Sync 0-400", "Sync 400-800", "Sync 800-1077"
- Each completes in ~7 minutes
- 3 button clicks = full sync

Would you like me to implement this?
