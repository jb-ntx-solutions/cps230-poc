# Search API Authentication Debugging

## Current Status

The Edge Function has been deployed with **enhanced logging** to diagnose the "Search API failed: Unauthorized" error.

## What Was Changed

Added detailed logging to track the authentication flow:

### 1. Site Authentication Logging
```typescript
// In authenticateProcessManager()
console.log(`Site auth successful. Token length: ${data.access_token?.length || 0}, Token type: ${data.token_type}, Expires in: ${data.expires_in}s`)
```

### 2. Search Token Request Logging
```typescript
// In getSearchToken()
console.error(`Search token request failed. URL: ${searchTokenUrl}, Status: ${response.status}, Body: ${errorText}`)
console.log(`Search token received. Token length: ${data.access_token?.length || 0}`)
```

### 3. Search API Request Logging
```typescript
// In searchCPS230Processes()
console.error(`Search API request failed. URL: ${pagedUrl}, Status: ${response.status}, Body: ${errorText}`)
```

## Next Steps

### 1. Run a Sync

Go to Settings → Nintex Process Manager → Click "Sync Now"

### 2. Check the Logs

Open the Edge Function logs:
https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/functions/sync-process-manager/logs

### 3. What to Look For

The logs should show one of these scenarios:

#### Scenario A: Site Auth Fails
```
Auth failed. URL: https://demo.promapp.com/93555a16ceb24f139a6e8a40618d3f8b/oauth2/token, Status: 401, Body: ...
```
**This means**: The Process Manager credentials are wrong or the endpoint changed.

#### Scenario B: Site Auth Succeeds, Search Token Fails
```
Site auth successful. Token length: 850, Token type: Bearer, Expires in: 60000s
Search token request failed. URL: https://demo.promapp.com/93555a16ceb24f139a6e8a40618d3f8b/search/GetSearchServiceToken, Status: 401, Body: ...
```
**This means**: The site token is valid, but it's not being accepted by the search token endpoint. Possible causes:
- Token format issue
- Missing required header
- Wrong endpoint path

#### Scenario C: Search Token Succeeds, Search API Fails
```
Site auth successful. Token length: 850, Token type: Bearer, Expires in: 60000s
Search token received. Token length: 920
Search API request failed. URL: https://dmo-wus-sch.promapp.io/fullsearch?SearchCriteria=CPS230&IncludedTypes=1&SearchMatchType=0&PageNumber=1&PageSize=100, Status: 401, Body: ...
```
**This means**: We got the search token successfully, but it's not being accepted by the search API. Possible causes:
- Search token has wrong format
- Wrong search endpoint URL
- Missing required query parameters

#### Scenario D: Everything Works
```
Site auth successful. Token length: 850, Token type: Bearer, Expires in: 60000s
Search token received. Token length: 920
Search API found 180 processes with CPS230 tag
180 processes to sync (180 total, 0 already processed)
Processing batch 1/2 (processes 1-100 of 180)
```
**This means**: The Search API optimization is working! Sync should complete in ~3-4 minutes.

## Expected Token Lengths

Based on the working curl example, the tokens should have these approximate lengths:

- **Site Token**: ~850 characters (JWT format)
- **Search Token**: Similar length, ~850-920 characters (JWT format)

If the token lengths are significantly different (e.g., < 100 characters), there's likely a problem with the token response format.

## Comparison with Working Example

The user provided this working curl example:
```bash
curl --location 'https://demo.promapp.com/93555a16ceb24f139a6e8a40618d3f8b/search/GetSearchServiceToken' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

Our code should be calling the exact same endpoint:
```
https://demo.promapp.com/93555a16ceb24f139a6e8a40618d3f8b/search/GetSearchServiceToken
```

With the same authorization header:
```
Authorization: Bearer <site_token>
```

## Possible Issues

1. **Token Encoding**: The token might need URL encoding or special handling
2. **Token Expiry**: The site token might be expiring before we use it for search
3. **Missing Headers**: The search endpoint might require additional headers
4. **Wrong Method**: Should be GET, but might need to be POST
5. **Response Format**: The search token response might not match our SearchAuthResponse interface

## If Still Failing

If the logs show that we're getting the search token successfully but it's being rejected by the search API, we'll need to:

1. Compare the actual token format from logs vs. working example
2. Check if the search endpoint requires any additional headers
3. Verify the search URL parameters are correct
4. Try different authentication header formats

## Migration Still Required

Don't forget to run the database migration before testing:

```sql
ALTER TABLE sync_history
ADD COLUMN IF NOT EXISTS last_processed_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processed_pm_ids INTEGER[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS examined_pm_ids INTEGER[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_sync_history_status_started
ON sync_history (status, started_at DESC)
WHERE status IN ('in_progress', 'failed');
```

Run this in: https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new
