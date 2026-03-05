import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateUser } from '../_shared/auth.ts'
import { validateCriticalOperationInput, ValidationError } from '../_shared/validation.ts'

serve(async (req: Request) => {
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
          // Get single critical operation with system and processes
          const { data: operation, error } = await supabaseClient
            .from('critical_operations')
            .select('*, system:systems(system_name)')
            .eq('id', id)
            .single()

          if (error) throw error

          // Get associated processes via junction table
          const { data: processRelations, error: processError } = await supabaseClient
            .from('critical_operation_processes')
            .select('processes:process_id(id, process_name)')
            .eq('critical_operation_id', id)

          if (processError) throw processError

          // Add processes to the operation object
          const operationWithProcesses = {
            ...operation,
            processes: processRelations?.map((rel: any) => rel.processes).filter(Boolean) || []
          }

          return new Response(JSON.stringify({ data: operationWithProcesses }), {
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          })
        } else {
          // Get all critical operations with system
          const { data: operations, error } = await supabaseClient
            .from('critical_operations')
            .select('*, system:systems(system_name)')
            .order('operation_name', { ascending: true })

          if (error) throw error

          // Get all process relationships for all operations
          const operationIds = operations?.map((op: any) => op.id) || []
          const { data: allProcessRelations } = await supabaseClient
            .from('critical_operation_processes')
            .select('critical_operation_id, processes:process_id(id, process_name)')
            .in('critical_operation_id', operationIds)

          // Group processes by critical operation
          const processesMap = new Map<string, any[]>()
          allProcessRelations?.forEach((rel: any) => {
            const processes = processesMap.get(rel.critical_operation_id) || []
            if (rel.processes) {
              processes.push(rel.processes)
            }
            processesMap.set(rel.critical_operation_id, processes)
          })

          // Add processes to each operation
          const operationsWithProcesses = operations?.map(op => ({
            ...op,
            processes: processesMap.get(op.id) || []
          })) || []

          return new Response(JSON.stringify({ data: operationsWithProcesses }), {
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          })
        }
      }

      case 'POST': {
        // Create critical operation
        const body = await req.json()
        const processIds: string[] = body.processIds || []

        // Validate and whitelist input fields
        const validatedData = validateCriticalOperationInput(body)

        // Get user's account_id for multi-tenancy
        const { data: profile, error: profileError } = await supabaseClient
          .from('user_profiles')
          .select('account_id')
          .eq('user_id', user.id)
          .single()

        if (profileError) throw profileError

        const { data: operation, error } = await supabaseClient
          .from('critical_operations')
          .insert({
            ...validatedData,
            account_id: profile.account_id,
            modified_by: user.email || 'unknown',
          })
          .select()
          .single()

        if (error) throw error

        // Create process relationships if processIds provided
        if (processIds.length > 0) {
          const processRelations = processIds.map(processId => ({
            critical_operation_id: operation.id,
            process_id: processId,
            modified_by: user.email || 'unknown',
          }))

          const { error: junctionError } = await supabaseClient
            .from('critical_operation_processes')
            .insert(processRelations)

          if (junctionError) {
            // Rollback: delete the created operation
            await supabaseClient
              .from('critical_operations')
              .delete()
              .eq('id', operation.id)
            throw junctionError
          }
        }

        return new Response(JSON.stringify({ data: operation }), {
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          status: 201,
        })
      }

      case 'PUT':
      case 'PATCH': {
        // Update critical operation
        if (!id) {
          throw new Error('ID is required for update')
        }

        const body = await req.json()
        const processIds: string[] | undefined = body.processIds

        // Validate and whitelist input fields
        const validatedData = validateCriticalOperationInput(body)

        const { data: operation, error } = await supabaseClient
          .from('critical_operations')
          .update({
            ...validatedData,
            modified_by: user.email || 'unknown',
            modified_date: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single()

        if (error) throw error

        // Update process relationships if processIds provided
        if (processIds !== undefined) {
          // Delete existing relationships
          const { error: deleteError } = await supabaseClient
            .from('critical_operation_processes')
            .delete()
            .eq('critical_operation_id', id)

          if (deleteError) throw deleteError

          // Create new relationships
          if (processIds.length > 0) {
            const processRelations = processIds.map(processId => ({
              critical_operation_id: id,
              process_id: processId,
              modified_by: user.email || 'unknown',
            }))

            const { error: junctionError } = await supabaseClient
              .from('critical_operation_processes')
              .insert(processRelations)

            if (junctionError) throw junctionError
          }
        }

        return new Response(JSON.stringify({ data: operation }), {
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        })
      }

      case 'DELETE': {
        // Delete critical operation
        if (!id) {
          throw new Error('ID is required for delete')
        }

        const { error } = await supabaseClient
          .from('critical_operations')
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
