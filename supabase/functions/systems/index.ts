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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } else {
          // Get all systems
          const { data, error } = await supabaseClient
            .from('systems')
            .select('*')
            .order('system_name', { ascending: true })

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      case 'POST': {
        // Create system
        const body = await req.json()
        const { data, error } = await supabaseClient
          .from('systems')
          .insert({
            ...body,
            modified_by: user.email || 'unknown',
          })
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        const { data, error } = await supabaseClient
          .from('systems')
          .update({
            ...body,
            modified_by: user.email || 'unknown',
            modified_date: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
