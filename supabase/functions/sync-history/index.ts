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
    const { supabaseClient } = await authenticateUser(authHeader)

    const url = new URL(req.url)
    const latest = url.searchParams.get('latest') === 'true'
    const limit = url.searchParams.get('limit')

    switch (req.method) {
      case 'GET': {
        if (latest) {
          // Get latest sync
          const { data, error } = await supabaseClient
            .from('sync_history')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } else {
          // Get sync history
          let query = supabaseClient
            .from('sync_history')
            .select('*')
            .order('started_at', { ascending: false })

          if (limit) {
            query = query.limit(parseInt(limit))
          } else {
            query = query.limit(10)
          }

          const { data, error } = await query

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      case 'PATCH': {
        // Update sync history (e.g., cancel sync)
        const id = url.searchParams.get('id')
        if (!id) {
          throw new Error('Sync ID is required for update')
        }

        const body = await req.json()
        const { data, error } = await supabaseClient
          .from('sync_history')
          .update(body)
          .eq('id', id)
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify({ data }), {
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
