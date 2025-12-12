import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { decryptValue, shouldEncrypt } from '../_shared/encryption.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROCESSES_PER_CALL = 5 // Process only 5 processes per function call (very conservative)

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

interface SearchResult {
  Name: string
  EntityType: string
  ProcessUniqueId?: string
  ItemUrl?: string
  HighLights?: {
    Activities?: string[]
    Tasks?: string[]
    LeanTags?: string[]
    ProcessTags?: string[]
  }
}

interface SearchResponse {
  success: boolean
  response: SearchResult[]
  paging: {
    TotalItemCount: number
    LastItemOnPage: number
    IsLastPage: boolean
    PageNumber: number
  }
}

// Map site URL to search endpoint region
function getSearchEndpoint(siteUrl: string): string {
  const regionMap: Record<string, string> = {
    'demo.promapp.com': 'dmo-wus-sch.promapp.io',
    'us.promapp.com': 'prd-wus-sch.promapp.io',
    'ca.promapp.com': 'prd-cac-sch.promapp.io',
    'eu.promapp.com': 'prd-neu-sch.promapp.io',
    'au.promapp.com': 'prd-aus-sch.promapp.io',
  }

  return regionMap[siteUrl] || 'prd-wus-sch.promapp.io' // Default to US
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
    const errorText = await response.text()
    console.error(`Auth failed. URL: ${authUrl}, Status: ${response.status}, Body: ${errorText}`)
    throw new Error(`Authentication failed: ${response.statusText}`)
  }

  const data: ProcessManagerAuthResponse = await response.json()
  console.log('Site authentication successful')
  return data.access_token
}

// Get Search Service token
async function getSearchToken(config: ProcessManagerConfig, siteToken: string): Promise<string> {
  const searchTokenUrl = `https://${config.siteUrl}/${config.tenantId}/search/GetSearchServiceToken`

  const response = await fetch(searchTokenUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${siteToken}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Search token request failed. URL: ${searchTokenUrl}, Status: ${response.status}, Body: ${errorText}`)
    throw new Error(`Failed to get search token: ${response.statusText}`)
  }

  const responseText = await response.text()
  console.log('Search token retrieved successfully')

  // Try parsing as JSON first
  let searchToken: string
  try {
    const data = JSON.parse(responseText)
    searchToken = data.Message || data.access_token || data.token || data.Token || data.AccessToken || responseText
  } catch (e) {
    // If not JSON, the response might be the token itself
    searchToken = responseText
  }

  return searchToken
}

// Search for processes with CPS230 tag using Search API
async function searchCPS230Processes(
  config: ProcessManagerConfig,
  searchToken: string
): Promise<string[]> {
  const searchEndpoint = getSearchEndpoint(config.siteUrl)
  const searchUrl = `https://${searchEndpoint}/fullsearch?SearchCriteria=%23CPS230&IncludedTypes=1&SearchMatchType=0`

  let allProcessUniqueIds: string[] = []
  let pageNumber = 1
  let hasMore = true

  while (hasMore) {
    const pagedUrl = `${searchUrl}&pageNumber=${pageNumber}&PageSize=100`

    console.log(`Calling search API, page: ${pageNumber}`)

    const response = await fetch(pagedUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${searchToken}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Search API request failed. URL: ${pagedUrl}, Status: ${response.status}`)
      throw new Error(`Search API failed: ${response.statusText}`)
    }

    const data: SearchResponse = await response.json()

    console.log(`Search API returned ${data.response?.length || 0} results. Success: ${data.success}`)

    if (!data.success) {
      console.error('Search API returned unsuccessful response:', JSON.stringify(data))
      throw new Error('Search API returned unsuccessful response')
    }

    // Filter results that have CPS230 in highlights
    const cps230Processes = data.response.filter(result => {
      const highlights = result.HighLights
      if (!highlights) {
        return true // If search returned it for "CPS230", include it
      }

      // Check all highlight types for #CPS230
      const allHighlights = [
        ...(highlights.Activities || []),
        ...(highlights.Tasks || []),
        ...(highlights.LeanTags || []),
        ...(highlights.ProcessTags || []),
      ].join(' ')

      return allHighlights.includes('#CPS230') || allHighlights.includes('#cps230') || allHighlights.includes('CPS230')
    })

    // Extract unique IDs from ProcessUniqueId or ItemUrl
    const uniqueIds = cps230Processes
      .map(p => {
        if (p.ProcessUniqueId) {
          return p.ProcessUniqueId
        }
        if (p.ItemUrl) {
          const match = p.ItemUrl.match(/\/Process\/([a-f0-9-]+)/i)
          if (match && match[1]) {
            return match[1]
          }
        }
        return null
      })
      .filter(id => id) // Filter out any null/undefined

    allProcessUniqueIds.push(...uniqueIds as string[])

    // Check if there are more pages
    hasMore = !data.paging.IsLastPage
    pageNumber++
  }

  return allProcessUniqueIds
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
    const activityTags = activity.Ownerships?.Tag || []
    for (const tag of activityTags) {
      if (tag.TagFamilyName === 'System') {
        systemTags.set(tag.Id, tag.Name)
      }
    }

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

// Extract control references from process details
function extractControls(processDetail: ProcessDetailResponse): Array<{ id: string; name: string }> {
  const controls = new Map<string, string>()
  const controlPattern = /#GRC_Control\s+(C-\d+)/gi

  const activities = processDetail.processJson.ProcessProcedures?.Activity || []

  const extractFromText = (text: string | null) => {
    if (!text) return
    let match
    while ((match = controlPattern.exec(text)) !== null) {
      const controlId = match[1]
      controls.set(controlId, controlId)
    }
  }

  for (const activity of activities) {
    extractFromText(activity.Text)
    extractFromText(activity.Attachment)

    const tasks = activity.ChildProcessProcedures?.Task || []
    for (const task of tasks) {
      extractFromText(task.Text)
      extractFromText(task.Attachment)
    }
  }

  return Array.from(controls.entries()).map(([id, name]) => ({ id, name }))
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

    const url = new URL(req.url)
    const mode = url.searchParams.get('mode') || 'init' // 'init' or 'process'

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

    // Verify user is a Promaster
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      throw new Error(`Authentication failed: ${userError?.message || 'No user found'}`)
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('role, account_id, email')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error(`Failed to fetch user profile: ${profileError?.message || 'No profile found'}`)
    }

    if (profile.role !== 'promaster') {
      throw new Error('Only Promasters can sync Process Manager data')
    }

    // Get Process Manager configuration
    const { data: settingsData, error: settingsError } = await supabaseClient
      .from('settings')
      .select('key, value')
      .in('key', ['pm_site_url', 'pm_username', 'pm_password', 'pm_tenant_id'])
      .eq('account_id', profile.account_id)

    if (settingsError || !settingsData || settingsData.length < 4) {
      throw new Error(`Process Manager configuration incomplete. Found ${settingsData?.length || 0} of 4 required settings.`)
    }

    // Decrypt settings
    const decryptedSettings = await Promise.all(
      settingsData.map(async (setting) => {
        let parsedValue = setting.value
        if (typeof parsedValue === 'string' && parsedValue.startsWith('"') && parsedValue.endsWith('"')) {
          parsedValue = JSON.parse(parsedValue)
        }

        if (shouldEncrypt(setting.key) && parsedValue) {
          try {
            const decryptedValue = await decryptValue(parsedValue as string)
            return { ...setting, value: decryptedValue }
          } catch (e) {
            console.error(`Failed to decrypt ${setting.key}`)
            return { ...setting, value: parsedValue }
          }
        }
        return { ...setting, value: parsedValue }
      })
    )

    const config: ProcessManagerConfig = {
      siteUrl: decryptedSettings.find(s => s.key === 'pm_site_url')?.value as string,
      username: decryptedSettings.find(s => s.key === 'pm_username')?.value as string,
      password: decryptedSettings.find(s => s.key === 'pm_password')?.value as string,
      tenantId: decryptedSettings.find(s => s.key === 'pm_tenant_id')?.value as string,
    }

    // ========================================================================
    // MODE 1: INITIALIZE - Search for processes and populate queue
    // ========================================================================
    if (mode === 'init') {
      console.log('MODE: INIT - Searching for CPS230 processes...')

      // Authenticate
      const bearerToken = await authenticateProcessManager(config)
      const searchToken = await getSearchToken(config, bearerToken)

      // Search for CPS230 processes
      const cps230ProcessUniqueIds = await searchCPS230Processes(config, searchToken)

      console.log(`Found ${cps230ProcessUniqueIds.length} CPS230 processes`)

      // Create sync record with process queue
      const { data: syncRecord, error: syncError } = await supabaseAdmin
        .from('sync_history')
        .insert({
          sync_type: 'full',
          status: 'in_progress',
          initiated_by: profile.email,
          account_id: profile.account_id,
          total_processes: cps230ProcessUniqueIds.length,
          processed_count: 0,
          process_queue: cps230ProcessUniqueIds,
        })
        .select()
        .single()

      if (syncError || !syncRecord) {
        throw new Error(`Failed to create sync record: ${syncError?.message}`)
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'init',
          syncId: syncRecord.id,
          totalProcesses: cps230ProcessUniqueIds.length,
          message: `Found ${cps230ProcessUniqueIds.length} processes. Call with mode=process to start processing.`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // ========================================================================
    // MODE 2: PROCESS - Process next batch from queue
    // ========================================================================
    if (mode === 'process') {
      console.log(`MODE: PROCESS - Processing next ${PROCESSES_PER_CALL} processes...`)

      // Find active sync
      const { data: syncRecord, error: syncError } = await supabaseAdmin
        .from('sync_history')
        .select('*')
        .eq('account_id', profile.account_id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

      if (syncError || !syncRecord) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No active sync found. Call with mode=init first.',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }

      const processQueue = syncRecord.process_queue || []
      const processedCount = syncRecord.processed_count || 0

      // Check if done
      if (processedCount >= processQueue.length) {
        await supabaseAdmin
          .from('sync_history')
          .update({
            status: 'success',
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncRecord.id)

        return new Response(
          JSON.stringify({
            success: true,
            mode: 'process',
            completed: true,
            totalProcessed: processedCount,
            message: 'Sync completed!',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      // Get next batch to process
      const batchStart = processedCount
      const batchEnd = Math.min(batchStart + PROCESSES_PER_CALL, processQueue.length)
      const batchProcessIds = processQueue.slice(batchStart, batchEnd)

      console.log(`Processing processes ${batchStart + 1}-${batchEnd} of ${processQueue.length}`)

      // Authenticate
      const bearerToken = await authenticateProcessManager(config)

      // Process each process in batch
      let successCount = 0
      for (const processUniqueId of batchProcessIds) {
        try {
          const processDetail = await fetchProcessDetails(config, bearerToken, processUniqueId)

          // Extract and upsert systems
          const systemTags = extractSystemTags(processDetail)
          const processSystemIds: string[] = []

          for (const systemTag of systemTags) {
            const { data: existingSystem } = await supabaseAdmin
              .from('systems')
              .select('id')
              .eq('pm_tag_id', systemTag.id.toString())
              .eq('account_id', profile.account_id)
              .maybeSingle()

            let system
            if (existingSystem) {
              const result = await supabaseAdmin
                .from('systems')
                .update({
                  system_name: systemTag.name,
                  system_id: systemTag.id.toString(),
                  modified_by: profile.email,
                })
                .eq('id', existingSystem.id)
                .select()
                .single()
              system = result.data
            } else {
              const result = await supabaseAdmin
                .from('systems')
                .insert({
                  system_name: systemTag.name,
                  system_id: systemTag.id.toString(),
                  pm_tag_id: systemTag.id.toString(),
                  modified_by: profile.email,
                  account_id: profile.account_id,
                })
                .select()
                .single()
              system = result.data
            }

            if (system) {
              processSystemIds.push(system.id)
            }
          }

          // Extract and upsert controls
          const controlRefs = extractControls(processDetail)
          const processControlIds: string[] = []

          for (const controlRef of controlRefs) {
            const { data: existingControl } = await supabaseAdmin
              .from('controls')
              .select('id')
              .eq('pm_control_id', controlRef.id)
              .eq('account_id', profile.account_id)
              .maybeSingle()

            let control
            if (existingControl) {
              const result = await supabaseAdmin
                .from('controls')
                .update({
                  control_name: controlRef.name,
                  modified_by: profile.email,
                })
                .eq('id', existingControl.id)
                .select()
                .single()
              control = result.data
            } else {
              const result = await supabaseAdmin
                .from('controls')
                .insert({
                  control_name: controlRef.name,
                  pm_control_id: controlRef.id,
                  modified_by: profile.email,
                  account_id: profile.account_id,
                })
                .select()
                .single()
              control = result.data
            }

            if (control) {
              processControlIds.push(control.id)
            }
          }

          // Upsert process
          const { data: existingProcess } = await supabaseAdmin
            .from('processes')
            .select('id')
            .eq('pm_process_id', processDetail.processJson.Id)
            .eq('account_id', profile.account_id)
            .maybeSingle()

          let savedProcess
          if (existingProcess) {
            const result = await supabaseAdmin
              .from('processes')
              .update({
                process_name: processDetail.processJson.Name,
                process_unique_id: processDetail.processJson.UniqueId,
                owner_username: processDetail.processJson.Owner || null,
                modified_by: profile.email,
              })
              .eq('id', existingProcess.id)
              .select()
              .single()
            savedProcess = result.data
          } else {
            const result = await supabaseAdmin
              .from('processes')
              .insert({
                process_name: processDetail.processJson.Name,
                process_unique_id: processDetail.processJson.UniqueId,
                pm_process_id: processDetail.processJson.Id,
                owner_username: processDetail.processJson.Owner || null,
                modified_by: profile.email,
                account_id: profile.account_id,
              })
              .select()
              .single()
            savedProcess = result.data
          }

          if (savedProcess) {
            // Update process-system relationships
            await supabaseAdmin
              .from('process_systems')
              .delete()
              .eq('process_id', savedProcess.id)

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

            // Update process-control relationships
            await supabaseAdmin
              .from('process_controls')
              .delete()
              .eq('process_id', savedProcess.id)

            if (processControlIds.length > 0) {
              await supabaseAdmin
                .from('process_controls')
                .insert(
                  processControlIds.map(controlId => ({
                    process_id: savedProcess.id,
                    control_id: controlId,
                  }))
                )
            }

            successCount++
          }
        } catch (error: any) {
          console.error(`Failed to process ${processUniqueId}:`, error?.message)
          // Continue with next process
        }
      }

      // Update progress
      const newProcessedCount = processedCount + successCount
      await supabaseAdmin
        .from('sync_history')
        .update({
          processed_count: newProcessedCount,
          records_synced: newProcessedCount,
        })
        .eq('id', syncRecord.id)

      const remaining = processQueue.length - newProcessedCount
      const percentComplete = Math.round((newProcessedCount / processQueue.length) * 100)

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'process',
          syncId: syncRecord.id,
          processed: newProcessedCount,
          total: processQueue.length,
          remaining: remaining,
          percentComplete: percentComplete,
          message: remaining > 0
            ? `Processed ${successCount} processes. ${remaining} remaining. Call again to continue.`
            : 'Batch complete! Call again to finish sync.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    throw new Error('Invalid mode. Use mode=init or mode=process')
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
