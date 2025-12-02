# Security Fixes Applied

## Critical Fixes Completed

### ✅ 1. Service Role Key Removed from Repository
**Status:** COMPLETED
**Changes:**
- Added `.mcp.json` and `.claude/` to `.gitignore`
- Removed `.mcp.json` from git tracking
- **ACTION REQUIRED:** Rotate the Supabase service role key at https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/settings/api

### ✅ 2. Settings Encryption Migration Created
**Status:** COMPLETED - Migration Ready
**Changes:**
- Created `supabase/migrations/20251201_fix_settings_security.sql`
- Fixed RLS policies to restrict sensitive settings access
- Added `is_sensitive` column to mark sensitive settings
- Created helper function `get_setting()` with role-based access
- Added TODO comments in `src/pages/Settings.tsx`

**ACTION REQUIRED:** Run the migration in Supabase:
```sql
-- Execute: supabase/migrations/20251201_fix_settings_security.sql
```

### ✅ 3. Fixed Overly Permissive RLS Policies
**Status:** COMPLETED
**Changes:**
- Updated `supabase/schema.sql` with granular settings policies
- Promasters can view ALL settings
- Regular users can only view non-sensitive settings (regions, bpmn_diagram, etc.)
- Sensitive settings (passwords, credentials) blocked for non-promasters

### ✅ 4. Input Validation Added
**Status:** COMPLETED for processes, NEEDS APPLICATION to other Edge Functions
**Changes:**
- Created `supabase/functions/_shared/validation.ts` with comprehensive validation utilities
- Updated `supabase/functions/processes/index.ts` with:
  - Input validation and whitelisting
  - Account_id enforcement (prevents multi-tenancy bypass)
  - Proper error handling for ValidationError

**ACTION REQUIRED:** Apply the same pattern to these Edge Functions:
- `supabase/functions/systems/index.ts`
- `supabase/functions/controls/index.ts`
- `supabase/functions/critical-operations/index.ts`
- `supabase/functions/user-profiles/index.ts`
- `supabase/functions/settings/index.ts`
- `supabase/functions/sync-history/index.ts`

Example pattern:
```typescript
import { validateSystemInput, ValidationError } from '../_shared/validation.ts'

// In POST handler:
const body = await req.json()
const validatedData = validateSystemInput(body)  // Or appropriate validator

// Get user's account_id
const { data: profile } = await supabaseClient
  .from('user_profiles')
  .select('account_id')
  .eq('user_id', user.id)
  .single()

// Insert with validated data only
await supabaseClient
  .from('systems')
  .insert({
    ...validatedData,  // Only whitelisted fields
    account_id: profile.account_id,  // Force correct account
    modified_by: user.email,
  })
```

### ✅ 5. Fixed CORS Policy
**Status:** COMPLETED - Needs Edge Function Updates
**Changes:**
- Updated `supabase/functions/_shared/cors.ts` with:
  - Whitelist of allowed origins
  - Dynamic origin checking
  - Environment-based configuration
  - New `getCorsHeaders(origin)` function

**ACTION REQUIRED:** Update all Edge Functions to use new CORS function:

Old code:
```typescript
return new Response(JSON.stringify({ data }), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})
```

New code:
```typescript
import { getCorsHeaders } from '../_shared/cors.ts'

// At the top of the handler:
const origin = req.headers.get('origin')

// In responses:
return new Response(JSON.stringify({ data }), {
  headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
})
```

Apply to:
- All Edge Functions in `supabase/functions/*/index.ts`

---

## High Priority Fixes - In Progress

### 6. Remove Sensitive Data from Logs
**Status:** NEEDS IMPLEMENTATION
**Affected:** `supabase/functions/sync-process-manager/index.ts` (38 console.log statements)

**Required Changes:**
- Remove token previews from logs
- Remove credential information from logs
- Implement structured logging with log levels
- Use generic messages instead of specific data

Example:
```typescript
// BEFORE (❌ INSECURE):
console.log(`Token: ${token.substring(0, 20)}...`)
console.log(`Password: ${password}`)

// AFTER (✅ SECURE):
console.log('Authentication successful')
console.log('Settings retrieved')
```

---

## Medium Priority Fixes - Pending

### 7. Add Rate Limiting
**Status:** NOT STARTED
**Recommendation:** Use Upstash Redis for distributed rate limiting

Required setup:
```bash
npm install @upstash/ratelimit @upstash/redis
```

Example implementation:
```typescript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),  // 10 requests per minute
})

// In each Edge Function:
const { success } = await ratelimit.limit(user.id)
if (!success) {
  return new Response('Too Many Requests', {
    status: 429,
    headers: getCorsHeaders(origin),
  })
}
```

### 8. Sanitize Chart Component
**Status:** NOT STARTED
**File:** `src/components/ui/chart.tsx`

Add color validation before using `dangerouslySetInnerHTML`:
```typescript
function isValidColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

// Before injecting:
const sanitizedColors = colorConfig.filter(([_, config]) =>
  isValidColor(config.color)
)
```

### 9. Move Supabase URL to Environment Variable
**Status:** NOT STARTED
**File:** `vercel.json`

Change from hardcoded URL to environment variable.

### 10. Add Security Headers
**Status:** NOT STARTED
**File:** `vercel.json`

Add:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" }
      ]
    }
  ]
}
```

---

## Testing Checklist

After applying all fixes:

- [ ] Rotate Supabase service role key
- [ ] Run settings security migration
- [ ] Test that basic users cannot access sensitive settings
- [ ] Test that Promasters can access all settings
- [ ] Test input validation on all Edge Functions
- [ ] Test CORS with both allowed and disallowed origins
- [ ] Verify no sensitive data in logs
- [ ] Test rate limiting (if implemented)
- [ ] Security scan with OWASP ZAP or similar
- [ ] Penetration testing

---

## Summary

**Completed:** 5/10 fixes
**In Progress:** 0/10
**Pending:** 5/10

**Estimated Remaining Work:** 4-6 hours

**Priority Order:**
1. ✅ Rotate service role key (IMMEDIATE)
2. ✅ Run settings security migration
3. Apply input validation to remaining Edge Functions (2 hours)
4. Update all Edge Functions to use new CORS (1 hour)
5. Remove sensitive data from logs (1 hour)
6. Implement rate limiting (2 hours)
7. Add security headers (30 minutes)
8. Final security testing (2 hours)
