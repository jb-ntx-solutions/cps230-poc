import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, getCorsHeaders } from '../_shared/cors.ts'
import { authenticateUser } from '../_shared/auth.ts'
import { validateSystemInput, ValidationError } from '../_shared/validation.ts'

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
    const id = url.searchParams.get('id')

    switch (req.method) {
      case 'GET': {
        if (id) {
          // Get single system
          const { data, error } = await supabaseClient
            .from('systems')
            .select('*')
            .eq('id', id)
            .single()

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          })
        } else {
          // Get all systems
          const { data, error } = await supabaseClient
            .from('systems')
            .select('*')
            .order('system_name', { ascending: true })

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          })
        }
      }

      case 'POST': {
        // Create system
        const body = await req.json()

        // Validate and whitelist input fields
        const validatedData = validateSystemInput(body)

        // Get user's account_id for multi-tenancy
        const { data: profile, error: profileError } = await supabaseClient
          .from('user_profiles')
          .select('account_id')
          .eq('user_id', user.id)
          .single()

        if (profileError) throw profileError

        const { data, error } = await supabaseClient
          .from('systems')
          .insert({
            ...validatedData,
            account_id: profile.account_id,
            modified_by: user.email || 'unknown',
          })
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify({ data }), {
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          status: 201,
        })
      }

      case 'PUT':
      case 'PATCH': {
        // Update system
        if (!id) {
          throw new Error('ID is required for update')
        }

        const body = await req.json()

        // Validate and whitelist input fields
        const validatedData = validateSystemInput(body)

        const { data, error } = await supabaseClient
          .from('systems')
          .update({
            ...validatedData,
            modified_by: user.email || 'unknown',
            modified_date: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify({ data }), {
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        })
      }

      case 'DELETE': {
        // Delete system
        if (!id) {
          throw new Error('ID is required for delete')
        }

        const { error } = await supabaseClient
          .from('systems')
          .delete()
          .eq('id', id)

        if (error) throw error

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
