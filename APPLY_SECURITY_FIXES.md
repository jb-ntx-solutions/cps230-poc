# Apply Security Fixes to Remaining Edge Functions

## ✅ Completed
- `processes/index.ts` - Input validation + CORS
- `systems/index.ts` - Input validation + CORS

## 🔄 Remaining Edge Functions

Apply the same pattern to these files:

### 1. controls/index.ts
### 2. critical-operations/index.ts
### 3. user-profiles/index.ts
### 4. settings/index.ts
### 5. sync-history/index.ts
### 6. sync-process-manager/index.ts

---

## Step-by-Step Pattern

For each Edge Function, make these changes:

### Step 1: Add Imports
```typescript
// At the top of the file
import { corsHeaders, getCorsHeaders } from '../_shared/cors.ts'
import { validateControlInput, ValidationError } from '../_shared/validation.ts'
// Use appropriate validator: validateControlInput, etc.
```

### Step 2: Get Origin
```typescript
serve(async (req) => {
  const origin = req.headers.get('origin')  // Add this line

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) })  // Update this
  }
  // ...
})
```

### Step 3: Fix POST Handler
```typescript
case 'POST': {
  const body = await req.json()

  // Add validation
  const validatedData = validateControlInput(body)  // Use appropriate validator

  // Get account_id for multi-tenancy
  const { data: profile, error: profileError } = await supabaseClient
    .from('user_profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .single()

  if (profileError) throw profileError

  const { data, error } = await supabaseClient
    .from('controls')  // Use appropriate table
    .insert({
      ...validatedData,  // Use validated data
      account_id: profile.account_id,  // Force correct account
      modified_by: user.email || 'unknown',
    })
    .select()
    .single()

  if (error) throw error

  return new Response(JSON.stringify({ data }), {
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },  // Update CORS
    status: 201,
  })
}
```

### Step 4: Fix PUT/PATCH Handler
```typescript
case 'PUT':
case 'PATCH': {
  if (!id) throw new Error('ID is required for update')

  const body = await req.json()

  // Add validation
  const validatedData = validateControlInput(body)  // Use appropriate validator

  const { data, error } = await supabaseClient
    .from('controls')  // Use appropriate table
    .update({
      ...validatedData,  // Use validated data
      modified_by: user.email || 'unknown',
      modified_date: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return new Response(JSON.stringify({ data }), {
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },  // Update CORS
  })
}
```

### Step 5: Update All Response Headers
Replace all instances of:
```typescript
headers: { ...corsHeaders, 'Content-Type': 'application/json' }
```

With:
```typescript
headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
```

### Step 6: Fix Error Handling
```typescript
} catch (error: any) {
  const status = error instanceof ValidationError ? 400 :
                 error.message === 'Unauthorized' ? 401 : 500

  return new Response(
    JSON.stringify({
      error: error.message || 'An error occurred',
    }),
    {
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      status,
    }
  )
}
```

---

## Validators Available

In `supabase/functions/_shared/validation.ts`:

- `validateProcessInput(body)` - For processes
- `validateSystemInput(body)` - For systems
- `validateControlInput(body)` - For controls
- `validateLimit(limit, default, max)` - For pagination
- `validateOffset(offset)` - For pagination
- `validateKeys(keys, allowedKeys)` - For filtering
- `validateUUID(uuid)` - For UUID validation
- `validateEmail(email)` - For email validation
- `sanitizeString(input, maxLength)` - For string sanitization

---

## Special Cases

### settings/index.ts
Use `validateKeys()` to whitelist allowed setting keys:
```typescript
const ALLOWED_KEYS = ['regions', 'bpmn_diagram', 'sync_frequency', 'last_sync_timestamp', 'nintex_api_url']
const keys = validateKeys(url.searchParams.get('keys'), ALLOWED_KEYS)
```

### sync-history/index.ts
Add pagination validation:
```typescript
const limit = validateLimit(url.searchParams.get('limit'), 10, 100)
const offset = validateOffset(url.searchParams.get('offset'))
```

### sync-process-manager/index.ts
**Remove sensitive logging:**
```typescript
// BEFORE (❌):
console.log(`Token: ${token.substring(0, 20)}...`)
console.log(`Password: ${password}`)

// AFTER (✅):
console.log('Authentication successful')
console.log('Settings retrieved')
```

---

## Testing Checklist

After applying fixes to each function:

- [ ] Test create operation with valid data
- [ ] Test create with invalid data (should return 400)
- [ ] Test create with extra fields (should be ignored)
- [ ] Test update operation
- [ ] Test with disallowed origin (should still work but with default origin)
- [ ] Test with allowed origin
- [ ] Verify account_id is enforced (can't create for different account)

---

## Quick Validation Test

```bash
# Test invalid input
curl -X POST https://your-project.supabase.co/functions/v1/controls \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"control_name": "Test", "account_id": "different-account", "hacker_field": "value"}'

# Should return:
# - 201 Created
# - account_id should be YOUR account (not the one in request)
# - hacker_field should NOT be in database
```

---

## Priority Order

1. **HIGH** - controls/index.ts
2. **HIGH** - critical-operations/index.ts
3. **MEDIUM** - user-profiles/index.ts
4. **MEDIUM** - settings/index.ts
5. **LOW** - sync-history/index.ts
6. **CRITICAL LOGGING** - sync-process-manager/index.ts (remove sensitive logs)

---

## Need Help?

Examples:
- ✅ processes/index.ts
- ✅ systems/index.ts

Both files have been fully updated with all security fixes applied.
