import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, getCorsHeaders } from '../_shared/cors.ts'
import { authenticateUser } from '../_shared/auth.ts'
import { validateKeys, sanitizeString, ValidationError } from '../_shared/validation.ts'
import { encryptValue, decryptValue, shouldEncrypt } from '../_shared/encryption.ts'

serve(async (req) => {
  const origin = req.headers.get('origin')

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const { user, supabaseClient } = await authenticateUser(authHeader)

    const url = new URL(req.url)

    // Whitelist allowed setting keys
    const ALLOWED_KEYS = [
      'regions',
      'bpmn_diagram',
      'sync_frequency',
      'last_sync_timestamp',
      'nintex_api_url',
      'nintex_username',
      'nintex_password',
      'nintex_tenant_id',
      'pm_site_url',
      'pm_username',
      'pm_password',
      'pm_tenant_id'
    ]
    const validKeys = url.searchParams.get('keys') ? validateKeys(url.searchParams.get('keys'), ALLOWED_KEYS) : ALLOWED_KEYS

    switch (req.method) {
      case 'GET': {
        // Get settings, optionally filtered by keys
        let query = supabaseClient.from('settings').select('*')

        if (validKeys && validKeys.length > 0) {
          query = query.in('key', validKeys)
        }

        const { data, error } = await query

        if (error) throw error

        // Decrypt sensitive values before returning
        const decryptedData = await Promise.all(
          (data || []).map(async (setting) => {
            if (shouldEncrypt(setting.key) && setting.value) {
              try {
                const decryptedValue = await decryptValue(setting.value)
                return { ...setting, value: decryptedValue }
              } catch (e) {
                // If decryption fails, value might not be encrypted yet
                console.error(`Failed to decrypt ${setting.key}:`, e)
                return setting
              }
            }
            return setting
          })
        )

        return new Response(JSON.stringify({ data: decryptedData }), {
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        })
      }

      case 'POST':
      case 'PUT': {
        // Upsert settings (batch update)
        const body = await req.json()
        const settings = body.settings || []

        if (!Array.isArray(settings) || settings.length === 0) {
          throw new Error('Settings array is required')
        }

        // Get user profile for account_id and email
        const { data: profile, error: profileError } = await supabaseClient
          .from('user_profiles')
          .select('email, account_id')
          .eq('user_id', user.id)
          .single()

        if (profileError || !profile) {
          throw new Error('User profile not found')
        }

        // Validate, sanitize, and encrypt each setting
        const updates = await Promise.all(
          settings.map(async (setting: any) => {
            // Validate key against whitelist
            if (!ALLOWED_KEYS.includes(setting.key)) {
              throw new ValidationError(`Invalid setting key: ${setting.key}`)
            }

            // Sanitize value if it's a string
            let processedValue = setting.value
            if (typeof setting.value === 'string') {
              processedValue = sanitizeString(setting.value, 5000)

              // Encrypt sensitive values
              if (shouldEncrypt(setting.key)) {
                processedValue = await encryptValue(processedValue)
              }
            }

            return {
              key: setting.key,
              value: processedValue,
              modified_by: profile.email,
              account_id: profile.account_id,
            }
          })
        )

        const { error } = await supabaseClient
          .from('settings')
          .upsert(updates, { onConflict: 'key,account_id' })

        if (error) throw error

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          status: 405,
        })
    }
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
})
