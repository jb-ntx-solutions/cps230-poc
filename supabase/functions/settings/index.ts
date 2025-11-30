import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { authenticateUser } from '../_shared/auth.ts'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const { user, supabaseClient } = await authenticateUser(authHeader)

    const url = new URL(req.url)
    const keys = url.searchParams.get('keys')?.split(',')

    switch (req.method) {
      case 'GET': {
        // Get settings, optionally filtered by keys
        let query = supabaseClient.from('settings').select('*')

        if (keys && keys.length > 0) {
          query = query.in('key', keys)
        }

        const { data, error } = await query

        if (error) throw error

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

        // Add account_id and modified_by to each setting
        const updates = settings.map((setting: any) => ({
          key: setting.key,
          value: setting.value,
          modified_by: profile.email,
          account_id: profile.account_id,
        }))

        const { error } = await supabaseClient
          .from('settings')
          .upsert(updates, { onConflict: 'key,account_id' })

        if (error) throw error

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405,
        })
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message === 'Unauthorized' ? 401 : 400,
      }
    )
  }
})
