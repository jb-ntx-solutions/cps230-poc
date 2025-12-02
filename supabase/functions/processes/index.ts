import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, getCorsHeaders } from '../_shared/cors.ts'
import { authenticateUser } from '../_shared/auth.ts'
import { validateProcessInput, ValidationError } from '../_shared/validation.ts'

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

          // Get associated controls
          const { data: controls } = await supabaseClient
            .from('controls')
            .select('id, control_name')
            .eq('process_id', id)

          // Get associated critical operations
          const { data: criticalOperations } = await supabaseClient
            .from('critical_operations')
            .select('id, operation_name')
            .eq('process_id', id)

          const processWithSystems = {
            ...process,
            systems: processSystems?.map(ps => ps.systems).filter(Boolean) || [],
            controls: controls || [],
            criticalOperations: criticalOperations || [],
          }

          return new Response(JSON.stringify({ data: processWithSystems }), {
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          })
        } else {
          // Get all processes
          const { data: processes, error: processError } = await supabaseClient
            .from('processes')
            .select('*')
            .order('process_name', { ascending: true })

          if (processError) throw processError

          // For each process, get its associated systems, controls, and critical operations
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

              const { data: controls } = await supabaseClient
                .from('controls')
                .select('id, control_name')
                .eq('process_id', process.id)

              const { data: criticalOperations } = await supabaseClient
                .from('critical_operations')
                .select('id, operation_name')
                .eq('process_id', process.id)

              return {
                ...process,
                systems: processSystems?.map(ps => ps.systems).filter(Boolean) || [],
                controls: controls || [],
                criticalOperations: criticalOperations || [],
              }
            })
          )

          return new Response(JSON.stringify({ data: processesWithSystems }), {
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          })
        }
      }

      case 'POST': {
        // Create process
        const body = await req.json()

        // Validate and whitelist input fields (prevents mass assignment)
        const validatedData = validateProcessInput(body)

        // Get user's account_id to enforce multi-tenancy
        const { data: profile, error: profileError } = await supabaseClient
          .from('user_profiles')
          .select('account_id')
          .eq('user_id', user.id)
          .single()

        if (profileError) throw profileError

        const { data, error } = await supabaseClient
          .from('processes')
          .insert({
            ...validatedData,
            account_id: profile.account_id, // Force correct account
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
        // Update process
        if (!id) {
          throw new Error('ID is required for update')
        }

        const body = await req.json()

        // Validate and whitelist input fields (prevents mass assignment)
        const validatedData = validateProcessInput(body)

        const { data, error} = await supabaseClient
          .from('processes')
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
    // Return 400 for validation errors, 500 for others
    const status = error instanceof ValidationError ? 400 : 500

    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
      }),
      {
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        status: error.message === 'Unauthorized' ? 401 : status,
      }
    )
  }
})
