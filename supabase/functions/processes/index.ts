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
          // Get single process
          const { data: process, error: processError } = await supabaseClient
            .from('processes')
            .select('*')
            .eq('id', id)
            .single()

          if (processError) throw processError

          // Get associated systems
          const { data: processSystems } = await supabaseClient
            .from('process_systems')
            .select(`
              system_id,
              systems:system_id (
                id,
                system_name
              )
            `)
            .eq('process_id', id)

          const processWithSystems = {
            ...process,
            systems: processSystems?.map(ps => ps.systems).filter(Boolean) || [],
          }

          return new Response(JSON.stringify({ data: processWithSystems }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } else {
          // Get all processes
          const { data: processes, error: processError } = await supabaseClient
            .from('processes')
            .select('*')
            .order('process_name', { ascending: true })

          if (processError) throw processError

          // For each process, get its associated systems
          const processesWithSystems = await Promise.all(
            (processes || []).map(async (process) => {
              const { data: processSystems } = await supabaseClient
                .from('process_systems')
                .select(`
                  system_id,
                  systems:system_id (
                    id,
                    system_name
                  )
                `)
                .eq('process_id', process.id)

              return {
                ...process,
                systems: processSystems?.map(ps => ps.systems).filter(Boolean) || [],
              }
            })
          )

          return new Response(JSON.stringify({ data: processesWithSystems }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      case 'POST': {
        // Create process
        const body = await req.json()
        const { data, error } = await supabaseClient
          .from('processes')
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
        // Update process
        if (!id) {
          throw new Error('ID is required for update')
        }

        const body = await req.json()
        const { data, error } = await supabaseClient
          .from('processes')
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
        // Delete process
        if (!id) {
          throw new Error('ID is required for delete')
        }

        const { error } = await supabaseClient
          .from('processes')
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
