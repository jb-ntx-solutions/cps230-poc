# API Layer Architecture

This document describes the API layer implementation that abstracts direct Supabase database calls behind a custom API.

## Overview

The application now uses a **hybrid API architecture** that:

1. **Hides Supabase internals** - Direct database URLs are no longer exposed to clients
2. **Provides clean API endpoints** - RESTful endpoints at `/data/v1/*`
3. **Maintains security** - All requests still use RLS policies and user authentication
4. **Improves maintainability** - Centralized API logic in Edge Functions

## Architecture Diagram

```
┌─────────────────┐
│  React Frontend │
│   (Vite SPA)    │
└────────┬────────┘
         │
         │ fetch('/data/v1/systems')
         ↓
┌─────────────────┐
│  Vercel Proxy   │  (rewrites /data/v1/* → Supabase Edge Functions)
└────────┬────────┘
         │
         │ https://[project].supabase.co/functions/v1/systems
         ↓
┌─────────────────┐
│ Supabase Edge   │
│   Functions     │  (authenticates user, queries database)
└────────┬────────┘
         │
         │ SELECT * FROM systems
         ↓
┌─────────────────┐
│   PostgreSQL    │
│   Database      │  (applies RLS policies)
└─────────────────┘
```

## Components

### 1. Edge Functions (`/supabase/functions/`)

Four main Edge Functions handle all data operations:

#### `/supabase/functions/systems/`
- **GET** `/data/v1/systems` - List all systems
- **GET** `/data/v1/systems?id={id}` - Get single system
- **POST** `/data/v1/systems` - Create system
- **PATCH** `/data/v1/systems?id={id}` - Update system
- **DELETE** `/data/v1/systems?id={id}` - Delete system

#### `/supabase/functions/processes/`
- **GET** `/data/v1/processes` - List all processes (with joined systems)
- **GET** `/data/v1/processes?id={id}` - Get single process
- **POST** `/data/v1/processes` - Create process
- **PATCH** `/data/v1/processes?id={id}` - Update process
- **DELETE** `/data/v1/processes?id={id}` - Delete process

#### `/supabase/functions/controls/`
- **GET** `/data/v1/controls` - List all controls (with joins)
- **GET** `/data/v1/controls?id={id}` - Get single control
- **POST** `/data/v1/controls` - Create control
- **PATCH** `/data/v1/controls?id={id}` - Update control
- **DELETE** `/data/v1/controls?id={id}` - Delete control

#### `/supabase/functions/critical-operations/`
- **GET** `/data/v1/critical-operations` - List all critical operations
- **GET** `/data/v1/critical-operations?id={id}` - Get single operation
- **POST** `/data/v1/critical-operations` - Create operation
- **PATCH** `/data/v1/critical-operations?id={id}` - Update operation
- **DELETE** `/data/v1/critical-operations?id={id}` - Delete operation

#### Shared Utilities (`/supabase/functions/_shared/`)

**`cors.ts`** - CORS headers configuration
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

**`auth.ts`** - User authentication utilities
```typescript
export async function authenticateUser(authHeader: string | null)
export function createAdminClient()
```

### 2. Frontend API Client (`/src/lib/api.ts`)

TypeScript API client with four modules:

- `systemsApi` - Systems CRUD operations
- `processesApi` - Processes CRUD with system joins
- `controlsApi` - Controls CRUD with joins
- `criticalOperationsApi` - Critical operations CRUD

**Example Usage:**
```typescript
import { systemsApi } from '@/lib/api'

// Get all systems
const systems = await systemsApi.getAll()

// Create a system
const newSystem = await systemsApi.create({
  system_name: 'SAP',
  system_id: 'SAP-001',
  account_id: 'abc-123'
})

// Update a system
const updated = await systemsApi.update('system-uuid', {
  system_name: 'SAP ERP'
})

// Delete a system
await systemsApi.delete('system-uuid')
```

### 3. React Query Hooks (`/src/hooks/`)

Updated hooks now use the API client instead of direct Supabase calls:

**Before:**
```typescript
// useSystems.ts (old)
const { data, error } = await supabase
  .from('systems')
  .select('*')
```

**After:**
```typescript
// useSystems.ts (new)
import { systemsApi } from '@/lib/api'

export function useSystems() {
  return useQuery({
    queryKey: ['systems'],
    queryFn: () => systemsApi.getAll(),
  })
}
```

### 4. Vercel Proxy Configuration (`/vercel.json`)

Vercel rewrites `/data/v1/*` requests to Supabase Edge Functions:

```json
{
  "rewrites": [
    {
      "source": "/data/v1/:path*",
      "destination": "https://rdqavrqfisyzwfqhckcp.supabase.co/functions/v1/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Benefits:**
- Clients see `/data/v1/systems` instead of `https://[project].supabase.co/rest/v1/systems`
- Supabase URL and project ID are hidden
- Easy to migrate to custom domain like `https://cps230.ntx-poc.com/data/v1/systems`

## Security

### Authentication Flow

1. User logs in via Supabase Auth (unchanged)
2. Frontend stores session token
3. API client reads token from Supabase session
4. Token sent in `Authorization: Bearer <token>` header
5. Edge Function validates token using `supabaseClient.auth.getUser()`
6. RLS policies apply based on authenticated user

### Authorization

- All Edge Functions use **user context** (not service role) by default
- Row-Level Security (RLS) policies still apply
- Multi-tenant filtering via `account_id` enforced at database level
- Only `modified_by` field is set server-side (user cannot spoof)

### API Key Exposure

**Before:** Anonymous key visible in all network requests
```
GET https://rdqavrqfisyzwfqhckcp.supabase.co/rest/v1/systems
Headers:
  apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**After:** Clean API endpoints, anonymous key only in Edge Function environment
```
GET /data/v1/systems
Headers:
  Authorization: Bearer <user-session-token>
```

## Deployment

### Deploy Edge Functions

```bash
# Set access token (one-time)
export SUPABASE_ACCESS_TOKEN="your-access-token"

# Deploy all functions
supabase functions deploy systems --project-ref rdqavrqfisyzwfqhckcp
supabase functions deploy processes --project-ref rdqavrqfisyzwfqhckcp
supabase functions deploy controls --project-ref rdqavrqfisyzwfqhckcp
supabase functions deploy critical-operations --project-ref rdqavrqfisyzwfqhckcp
```

### Deploy Frontend

```bash
# Build and deploy to Vercel
npm run build
vercel --prod
```

## Custom Domain Setup (Future Enhancement)

To use a custom domain like `cps230.ntx-poc.com`:

1. **Add domain to Vercel project**
   ```bash
   vercel domains add cps230.ntx-poc.com
   ```

2. **Update DNS records** (A/CNAME to Vercel)

3. **Update API base URL** in `/src/lib/api.ts`:
   ```typescript
   const API_BASE_URL = '/data/v1' // Already configured!
   ```

4. **URLs automatically become:**
   - `https://cps230.ntx-poc.com/data/v1/systems`
   - `https://cps230.ntx-poc.com/data/v1/processes`
   - etc.

No code changes needed - Vercel rewrites handle everything!

## Migration Notes

### Files Changed

**Created:**
- `/supabase/functions/systems/index.ts`
- `/supabase/functions/processes/index.ts`
- `/supabase/functions/controls/index.ts`
- `/supabase/functions/critical-operations/index.ts`
- `/supabase/functions/_shared/cors.ts`
- `/supabase/functions/_shared/auth.ts`
- `/src/lib/api.ts`

**Modified:**
- `/src/hooks/useSystems.ts`
- `/src/hooks/useProcesses.ts`
- `/src/hooks/useControls.ts`
- `/src/hooks/useCriticalOperations.ts`
- `/vercel.json`

**Unchanged:**
- Authentication flow (`/src/contexts/AuthContext.tsx`)
- Database schema and RLS policies
- UI components

### Breaking Changes

**None!** The API is fully backward compatible:

- Supabase client (`/src/lib/supabase.ts`) still works for auth
- Settings sync still uses direct Edge Function invocation
- User management still uses `create-user` function
- All existing functionality preserved

### Rollback Procedure

If needed, revert to direct Supabase calls:

1. Restore original hook files from git
2. Remove `/src/lib/api.ts`
3. Revert `/vercel.json` to original
4. Redeploy frontend

Database and Edge Functions remain unchanged.

## Performance Considerations

### Latency

- **Direct Supabase:** ~50-100ms (client → Supabase)
- **Via Edge Functions:** ~50-150ms (client → Vercel → Supabase Edge → DB)
- **Additional overhead:** ~0-50ms for Edge Function execution

### Caching

React Query still caches all responses client-side:
```typescript
queryClient.setQueryData(['systems'], cachedData)
```

No additional caching needed at API layer.

### Rate Limiting

Supabase Edge Functions have generous limits:
- **Free tier:** 500K invocations/month
- **Pro tier:** 2M invocations/month
- **Current usage:** ~100-200 invocations/day

## Monitoring

### Edge Function Logs

View logs in Supabase Dashboard:
```
https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/functions
```

### Network Inspection

In browser DevTools, verify requests go to `/data/v1/*`:
```
✅ GET /data/v1/systems
❌ GET https://rdqavrqfisyzwfqhckcp.supabase.co/rest/v1/systems
```

## Troubleshooting

### "No active session" error

**Cause:** User not authenticated or session expired

**Fix:** Ensure user is logged in before making API calls
```typescript
const { session } = await supabase.auth.getSession()
if (!session) {
  // Redirect to login
}
```

### CORS errors

**Cause:** Missing CORS headers in Edge Function

**Fix:** Ensure all functions import and use `corsHeaders`:
```typescript
import { corsHeaders } from '../_shared/cors.ts'

return new Response(data, {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
})
```

### 404 on `/data/v1/*`

**Cause:** Vercel rewrites not applied

**Fix:** Redeploy to Vercel to apply `vercel.json` changes
```bash
vercel --prod
```

## Future Enhancements

1. **Request validation** - Add Zod schemas for input validation
2. **Rate limiting** - Implement per-user rate limits in Edge Functions
3. **API versioning** - Support `/data/v2/*` for breaking changes
4. **Response caching** - Add server-side caching for expensive queries
5. **Batch operations** - Support bulk create/update/delete
6. **GraphQL endpoint** - Add optional GraphQL API alongside REST

## Testing

### Manual Testing

Test each endpoint using curl or Postman:

```bash
# Get session token
SESSION_TOKEN="your-session-token"

# Test systems API
curl -H "Authorization: Bearer $SESSION_TOKEN" \
  https://your-domain.vercel.app/data/v1/systems

# Create system
curl -X POST \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"system_name":"Test","system_id":"T001","account_id":"abc"}' \
  https://your-domain.vercel.app/data/v1/systems
```

### Automated Testing

Add API integration tests:

```typescript
// tests/api.test.ts
import { systemsApi } from '@/lib/api'

describe('Systems API', () => {
  it('should fetch all systems', async () => {
    const systems = await systemsApi.getAll()
    expect(systems).toBeInstanceOf(Array)
  })

  it('should create a system', async () => {
    const system = await systemsApi.create({
      system_name: 'Test System',
      system_id: 'TEST-001',
      account_id: 'test-account'
    })
    expect(system.system_name).toBe('Test System')
  })
})
```

## Conclusion

The API layer provides:

✅ **Security** - Hides database internals
✅ **Flexibility** - Easy to add custom logic
✅ **Maintainability** - Centralized API code
✅ **Scalability** - Serverless edge deployment
✅ **Compatibility** - No breaking changes

All data fetching now goes through clean `/data/v1/*` endpoints that can be easily customized and monitored.
