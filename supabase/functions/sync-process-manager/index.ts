import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 100 // Process 100 processes per batch to avoid timeout
const MAX_EXECUTION_TIME = 8 * 60 * 1000 // 8 minutes max (leave 2 min buffer before 10min timeout)

interface ProcessManagerConfig {
  siteUrl: string
  username: string
  password: string
  tenantId: string
}

interface ProcessManagerAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface ProcessListResponse {
  items: Array<{
    processId: number
    processName: string
    processUniqueId: string
    processOwner: string | null
    groupName: string | null
  }>
  totalItemCount: number
}

interface ProcessDetailResponse {
  processJson: {
    Id: number
    UniqueId: string
    Name: string
    Owner: string | null
    ProcessTags?: {
      ProcessTag?: Array<{
        Id: number
        Name: string
      }>
    }
    ProcessProcedures?: {
      Activity?: Array<{
        Ownerships?: {
          Tag?: Array<{
            Id: number
            Name: string
            TagFamilyName: string
          }>
        }
        ChildProcessProcedures?: {
          Task?: Array<{
            Ownerships?: {
              Tag?: Array<{
                Id: number
                Name: string
                TagFamilyName: string
              }>
            }
          }>
        }
      }>
    }
  }
}

// Authenticate with Process Manager and get bearer token
async function authenticateProcessManager(config: ProcessManagerConfig): Promise<string> {
  const authUrl = `https://${config.siteUrl}/${config.tenantId}/oauth2/token`

  const formData = new URLSearchParams()
  formData.append('grant_type', 'password')
  formData.append('username', config.username)
  formData.append('password', config.password)
  formData.append('duration', '60000')

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  })

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.statusText}`)
  }

  const data: ProcessManagerAuthResponse = await response.json()
  return data.access_token
}

// Fetch all processes from Process Manager (with pagination)
async function fetchAllProcesses(
  config: ProcessManagerConfig,
  bearerToken: string
): Promise<ProcessListResponse['items']> {
  const baseUrl = `https://${config.siteUrl}/${config.tenantId}/Bff/Process/api/v1/processes`
  let allProcesses: ProcessListResponse['items'] = []
  let page = 1
  const pageSize = 100
  let hasMore = true

  while (hasMore) {
    const url = `${baseUrl}?Page=${page}&PageSize=${pageSize}`
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch processes: ${response.statusText}`)
    }

    const data: ProcessListResponse = await response.json()
    allProcesses = allProcesses.concat(data.items)

    hasMore = allProcesses.length < data.totalItemCount
    page++
  }

  return allProcesses
}

// Fetch process details including tags and systems
async function fetchProcessDetails(
  config: ProcessManagerConfig,
  bearerToken: string,
  processUniqueId: string
): Promise<ProcessDetailResponse> {
  const url = `https://${config.siteUrl}/${config.tenantId}/Api/v1/Processes/${processUniqueId}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch process details: ${response.statusText}`)
  }

  return await response.json()
}

// Extract system tags from process details
function extractSystemTags(processDetail: ProcessDetailResponse): Array<{ id: number; name: string }> {
  const systemTags = new Map<number, string>()
  const activities = processDetail.processJson.ProcessProcedures?.Activity || []

  for (const activity of activities) {
    // Check activity-level tags
    const activityTags = activity.Ownerships?.Tag || []
    for (const tag of activityTags) {
      if (tag.TagFamilyName === 'System') {
        systemTags.set(tag.Id, tag.Name)
      }
    }

    // Check task-level tags
    const tasks = activity.ChildProcessProcedures?.Task || []
    for (const task of tasks) {
      const taskTags = task.Ownerships?.Tag || []
      for (const tag of taskTags) {
        if (tag.TagFamilyName === 'System') {
          systemTags.set(tag.Id, tag.Name)
        }
      }
    }
  }

  return Array.from(systemTags.entries()).map(([id, name]) => ({ id, name }))
}

// Check if process has CPS230 tag
function hasCPS230Tag(processDetail: ProcessDetailResponse): boolean {
  const processTags = processDetail.processJson.ProcessTags?.ProcessTag || []
  return processTags.some(tag => tag.Name === 'CPS230')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace('Bearer ', '')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify user is a Promaster - use getUser with the token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError) {
      console.error('Auth error:', userError)
      throw new Error(`Authentication failed: ${userError.message}`)
    }
    if (!user) {
      throw new Error('No authenticated user found')
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('role, account_id, email')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('Profile query error:', profileError)
      throw new Error(`Failed to fetch user profile: ${profileError.message}`)
    }

    if (!profile) {
      throw new Error('User profile not found')
    }

    if (profile.role !== 'promaster') {
      throw new Error('Only Promasters can sync Process Manager data')
    }

    // Get Process Manager configuration from settings
    // Use OR condition to get settings that match account_id OR are null (for backwards compatibility)
    const { data: settingsData, error: settingsError } = await supabaseClient
      .from('settings')
      .select('key, value')
      .in('key', ['pm_site_url', 'pm_username', 'pm_password', 'pm_tenant_id'])
      .or(`account_id.eq.${profile.account_id},account_id.is.null`)

    if (settingsError) {
      console.error('Settings query error:', settingsError)
      throw new Error(`Failed to fetch settings: ${settingsError.message}`)
    }

    if (!settingsData || settingsData.length < 4) {
      console.error('Settings data:', settingsData)
      throw new Error(`Process Manager configuration incomplete. Found ${settingsData?.length || 0} of 4 required settings. Please configure in settings.`)
    }

    const config: ProcessManagerConfig = {
      siteUrl: settingsData.find(s => s.key === 'pm_site_url')?.value as string,
      username: settingsData.find(s => s.key === 'pm_username')?.value as string,
      password: settingsData.find(s => s.key === 'pm_password')?.value as string,
      tenantId: settingsData.find(s => s.key === 'pm_tenant_id')?.value as string,
    }

    // Create sync history record
    const { data: syncRecord } = await supabaseAdmin
      .from('sync_history')
      .insert({
        sync_type: 'full',
        status: 'in_progress',
        initiated_by: profile.email,
        account_id: profile.account_id,
      })
      .select()
      .single()

    if (!syncRecord) {
      throw new Error('Failed to create sync history record')
    }

    // Start the sync process asynchronously (don't await)
    // This allows us to return immediately to the client
    (async () => {
      const startTime = Date.now()

      try {
        // Authenticate with Process Manager
        const bearerToken = await authenticateProcessManager(config)

        // Fetch all processes
        const allProcesses = await fetchAllProcesses(config, bearerToken)

        // Update sync record with total count
        await supabaseAdmin
          .from('sync_history')
          .update({
            total_processes: allProcesses.length,
            processed_count: 0,
          })
          .eq('id', syncRecord.id)

      let processesProcessed = 0
      let systemsAdded = 0
      let totalProcessedCount = 0
      const processedSystemIds = new Set<number>()

      // Track existing processes and systems for cleanup
      const { data: existingProcesses } = await supabaseAdmin
        .from('processes')
        .select('id, pm_process_id')
        .eq('account_id', profile.account_id)

      const existingPmProcessIds = new Set(
        existingProcesses?.map(p => p.pm_process_id).filter(id => id !== null) || []
      )

      const syncedProcessIds = new Set<number>()

      // Process in batches to avoid timeout
      const totalBatches = Math.ceil(allProcesses.length / BATCH_SIZE)

      for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
        // Check if we're approaching timeout (8 minutes)
        const elapsedTime = Date.now() - startTime
        if (elapsedTime > MAX_EXECUTION_TIME) {
          console.log(`Approaching timeout at ${elapsedTime}ms. Exiting gracefully at batch ${batchNum}/${totalBatches}`)
          await supabaseAdmin
            .from('sync_history')
            .update({
              status: 'failed',
              error_message: `Timeout after processing ${totalProcessedCount} of ${allProcesses.length} processes. Completed ${batchNum - 1} of ${totalBatches} batches.`,
              completed_at: new Date().toISOString(),
              records_synced: processesProcessed,
            })
            .eq('id', syncRecord.id)
          return
        }

        const startIdx = (batchNum - 1) * BATCH_SIZE
        const endIdx = Math.min(startIdx + BATCH_SIZE, allProcesses.length)
        const batchProcesses = allProcesses.slice(startIdx, endIdx)

        console.log(`Processing batch ${batchNum}/${totalBatches} (processes ${startIdx + 1}-${endIdx} of ${allProcesses.length})`)

        // Update batch info
        await supabaseAdmin
          .from('sync_history')
          .update({
            current_batch: batchNum,
            total_batches: totalBatches,
            batch_size: BATCH_SIZE,
          })
          .eq('id', syncRecord.id)

        // Process each process in this batch
        for (let i = 0; i < batchProcesses.length; i++) {
          const process = batchProcesses[i]
          const globalIndex = startIdx + i

          // Check if sync was cancelled every 10 processes
          if (i % 10 === 0) {
            const { data: currentSync } = await supabaseAdmin
              .from('sync_history')
              .select('status')
              .eq('id', syncRecord.id)
              .single()

            if (currentSync?.status === 'cancelled') {
              console.log(`Sync cancelled by user at process ${globalIndex}/${allProcesses.length}`)
              await supabaseAdmin
                .from('sync_history')
                .update({
                  completed_at: new Date().toISOString(),
                  records_synced: processesProcessed,
                })
                .eq('id', syncRecord.id)
              return // Exit the sync process
            }
          }

          let processDetail: ProcessDetailResponse
          try {
            // Fetch full process details
            processDetail = await fetchProcessDetails(config, bearerToken, process.processUniqueId)

            // Increment total processed count
            totalProcessedCount++

            // Update progress every 10 processes
            if (totalProcessedCount % 10 === 0 || totalProcessedCount === allProcesses.length) {
              console.log(`Progress: ${totalProcessedCount}/${allProcesses.length} processes examined, ${processesProcessed} with CPS230 tag`)
              await supabaseAdmin
                .from('sync_history')
                .update({
                  processed_count: totalProcessedCount,
                })
                .eq('id', syncRecord.id)
            }

            // Only process if it has CPS230 tag
            if (!hasCPS230Tag(processDetail)) {
              continue
            }
          } catch (error: any) {
            console.error(`Failed to fetch process ${globalIndex}/${allProcesses.length} (${process.processName}):`, error?.message || error)
            totalProcessedCount++
            continue
          }

        syncedProcessIds.add(processDetail.processJson.Id)

        // Extract and save systems
        const systemTags = extractSystemTags(processDetail)
        const processSystemIds: string[] = []

        for (const systemTag of systemTags) {
          if (processedSystemIds.has(systemTag.id)) {
            // System already processed, just get its UUID
            const { data: existingSystem } = await supabaseAdmin
              .from('systems')
              .select('id')
              .eq('pm_tag_id', systemTag.id.toString())
              .eq('account_id', profile.account_id)
              .single()

            if (existingSystem) {
              processSystemIds.push(existingSystem.id)
            }
            continue
          }

          // Upsert system
          const { data: system } = await supabaseAdmin
            .from('systems')
            .upsert({
              system_name: systemTag.name,
              system_id: systemTag.id.toString(),
              pm_tag_id: systemTag.id.toString(),
              modified_by: profile.email,
              account_id: profile.account_id,
            }, {
              onConflict: 'pm_tag_id,account_id',
            })
            .select()
            .single()

          if (system) {
            processSystemIds.push(system.id)
            processedSystemIds.add(systemTag.id)
            systemsAdded++
          }
        }

        // Upsert process
        const { data: savedProcess } = await supabaseAdmin
          .from('processes')
          .upsert({
            process_name: processDetail.processJson.Name,
            process_unique_id: processDetail.processJson.UniqueId,
            pm_process_id: processDetail.processJson.Id,
            owner_username: processDetail.processJson.Owner || null,
            modified_by: profile.email,
            account_id: profile.account_id,
          }, {
            onConflict: 'pm_process_id,account_id',
          })
          .select()
          .single()

        if (savedProcess) {
          // Update process-system relationships
          // First, delete existing relationships for this process
          await supabaseAdmin
            .from('process_systems')
            .delete()
            .eq('process_id', savedProcess.id)

          // Then, create new relationships
          if (processSystemIds.length > 0) {
            await supabaseAdmin
              .from('process_systems')
              .insert(
                processSystemIds.map(systemId => ({
                  process_id: savedProcess.id,
                  system_id: systemId,
                }))
              )
          }

          processesProcessed++
        }

        // Add small delay to avoid rate limiting (reduced from 100ms to 50ms)
        await new Promise(resolve => setTimeout(resolve, 50))
        }

        console.log(`Completed batch ${batchNum}/${totalBatches}`)
      }

      // Clean up processes that no longer have CPS230 tag or were deleted
      const processesToDelete = Array.from(existingPmProcessIds).filter(
        id => !syncedProcessIds.has(id as number)
      )

      if (processesToDelete.length > 0) {
        await supabaseAdmin
          .from('processes')
          .delete()
          .in('pm_process_id', processesToDelete)
          .eq('account_id', profile.account_id)
      }

      // Update sync history
      await supabaseAdmin
        .from('sync_history')
        .update({
          status: 'success',
          records_synced: processesProcessed,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncRecord.id)

      // Update last sync timestamp in settings
      await supabaseAdmin
        .from('settings')
        .upsert({
          key: 'last_sync_timestamp',
          value: new Date().toISOString(),
          modified_by: profile.email,
          account_id: profile.account_id,
        }, {
          onConflict: 'key,account_id',
        })

      console.log(`Sync completed: ${processesProcessed} processes, ${systemsAdded} systems, ${processesToDelete.length} deleted`)
    } catch (error: any) {
      // Update sync history with error
      console.error('Sync error:', error)
      await supabaseAdmin
        .from('sync_history')
        .update({
          status: 'failed',
          error_message: error?.message || 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncRecord.id)
    }
    })() // Execute the async function immediately

    // Return immediately to the client with sync started status
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sync started',
        syncId: syncRecord.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
