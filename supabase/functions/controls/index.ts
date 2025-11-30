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
          // Get single control
          const { data, error } = await supabaseClient
            .from('controls')
            .select(`
              *,
              critical_operation:critical_operations(operation_name),
              process:processes(process_name),
              system:systems(system_name)
            `)
            .eq('id', id)
            .single()

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } else {
          // Get all controls
          const { data, error } = await supabaseClient
            .from('controls')
            .select(`
              *,
              critical_operation:critical_operations(operation_name),
              process:processes(process_name),
              system:systems(system_name)
            `)
            .order('created_at', { ascending: false })

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      case 'POST': {
        // Create control
        const body = await req.json()
        const { data, error } = await supabaseClient
          .from('controls')
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
        // Update control
        if (!id) {
          throw new Error('ID is required for update')
        }

        const body = await req.json()
        const { data, error } = await supabaseClient
          .from('controls')
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
        // Delete control
        if (!id) {
          throw new Error('ID is required for delete')
        }

        const { error } = await supabaseClient
          .from('controls')
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
