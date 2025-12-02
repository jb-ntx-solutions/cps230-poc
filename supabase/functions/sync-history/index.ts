import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, getCorsHeaders } from '../_shared/cors.ts'
import { authenticateUser } from '../_shared/auth.ts'
import { validateLimit, ValidationError } from '../_shared/validation.ts'

serve(async (req) => {
  const origin = req.headers.get('origin')

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const { supabaseClient } = await authenticateUser(authHeader)

    const url = new URL(req.url)
    const latest = url.searchParams.get('latest') === 'true'
    const limit = validateLimit(url.searchParams.get('limit'), 10, 100)

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
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          })
        } else {
          // Get sync history
          const query = supabaseClient
            .from('sync_history')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(limit)

          const { data, error } = await query

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
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

        // Only allow updating status field
        const allowedUpdates = {
          status: body.status,
        }

        const { data, error } = await supabaseClient
          .from('sync_history')
          .update(allowedUpdates)
          .eq('id', id)
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify({ data }), {
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
