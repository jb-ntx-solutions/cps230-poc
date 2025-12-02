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

interface SearchAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
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

    // Log first result for debugging
    if (data.response && data.response.length > 0) {
      console.log(`First result sample: ${JSON.stringify(data.response[0]).substring(0, 300)}`)
    }

    // Filter results that have CPS230 in highlights
    const cps230Processes = data.response.filter(result => {
      const highlights = result.HighLights
      if (!highlights) {
        console.log(`Result ${result.Name} has no HighLights, including it anyway since search returned it`)
        return true // If search returned it for "CPS230", include it even without highlights
      }

      // Check all highlight types for #CPS230
      const allHighlights = [
        ...(highlights.Activities || []),
        ...(highlights.Tasks || []),
        ...(highlights.LeanTags || []),
        ...(highlights.ProcessTags || []),
      ].join(' ')

      const hasCPS230 = allHighlights.includes('#CPS230') || allHighlights.includes('#cps230') || allHighlights.includes('CPS230')
      if (!hasCPS230) {
        console.log(`Result ${result.Name} highlights don't contain #CPS230: ${allHighlights.substring(0, 100)}`)
      }
      return hasCPS230
    })

    console.log(`Filtered to ${cps230Processes.length} processes with CPS230 in highlights`)

    // Extract unique IDs from ProcessUniqueId or ItemUrl
    const uniqueIds = cps230Processes
      .map(p => {
        // Try ProcessUniqueId first
        if (p.ProcessUniqueId) {
          return p.ProcessUniqueId
        }
        // Extract from ItemUrl if ProcessUniqueId not available
        if (p.ItemUrl) {
          const match = p.ItemUrl.match(/\/Process\/([a-f0-9-]+)/i)
          if (match && match[1]) {
            return match[1]
          }
        }
        console.log(`Could not extract ID for process: ${p.Name}`)
        return null
      })
      .filter(id => id) // Filter out any null/undefined

    console.log(`Extracted ${uniqueIds.length} unique IDs`)
    allProcessUniqueIds.push(...uniqueIds as string[])

    // Check if there are more pages
    hasMore = !data.paging.IsLastPage
    pageNumber++
  }

  return allProcessUniqueIds
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

    // Check if there's a failed sync that should be resumed
    const { data: failedSync } = await supabaseAdmin
      .from('sync_history')
      .select('*')
      .eq('account_id', profile.account_id)
      .eq('status', 'failed')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    let syncRecord
    let isResume = false

    if (failedSync && failedSync.processed_pm_ids && failedSync.processed_pm_ids.length > 0) {
      // Resume the failed sync
      console.log(`Resuming failed sync ${failedSync.id} with ${failedSync.processed_pm_ids.length} already-processed processes`)
      syncRecord = failedSync
      isResume = true

      // Update status back to in_progress
      await supabaseAdmin
        .from('sync_history')
        .update({
          status: 'in_progress',
          error_message: null,
        })
        .eq('id', syncRecord.id)
    } else {
      // Create new sync history record
      const { data: newSync } = await supabaseAdmin
        .from('sync_history')
        .insert({
          sync_type: 'full',
          status: 'in_progress',
          initiated_by: profile.email,
          account_id: profile.account_id,
        })
        .select()
        .single()

      if (!newSync) {
        throw new Error('Failed to create sync history record')
      }
      syncRecord = newSync
    }

    // Start the sync process asynchronously (don't await)
    // This allows us to return immediately to the client
    (async () => {
      const startTime = Date.now()

      try {
        // Authenticate with Process Manager
        const bearerToken = await authenticateProcessManager(config)

        // Get search token
        console.log('Getting search service token...')
        const searchToken = await getSearchToken(config, bearerToken)

        // Use Search API to find CPS230 processes (much faster than checking all processes!)
        console.log('Searching for CPS230 processes using Search API...')
        const cps230ProcessUniqueIds = await searchCPS230Processes(config, searchToken)

        console.log(`Search API found ${cps230ProcessUniqueIds.length} processes with CPS230 tag`)

        // Update sync record with total count
        await supabaseAdmin
          .from('sync_history')
          .update({
            total_processes: cps230ProcessUniqueIds.length,
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
      const examinedProcessIds = new Set<number>()

      // If resuming, load already-processed unique IDs from sync record
      const alreadyProcessedUniqueIds = new Set<string>(syncRecord.processed_pm_ids?.map(String) || [])

      if (alreadyProcessedUniqueIds.size > 0) {
        console.log(`Resuming sync ${syncRecord.id}. Skipping ${alreadyProcessedUniqueIds.size} already-processed processes.`)
        // Add to tracking sets
        alreadyProcessedUniqueIds.forEach(id => {
          const numId = parseInt(id)
          if (!isNaN(numId)) {
            syncedProcessIds.add(numId)
          }
        })
      }

      // Filter out already-processed unique IDs
      const processesToSync = cps230ProcessUniqueIds.filter(uid => !alreadyProcessedUniqueIds.has(uid))

      console.log(`${processesToSync.length} processes to sync (${cps230ProcessUniqueIds.length} total, ${alreadyProcessedUniqueIds.size} already processed)`)

      // Process in batches to avoid timeout
      const totalBatches = Math.ceil(processesToSync.length / BATCH_SIZE)

      for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
        const startIdx = (batchNum - 1) * BATCH_SIZE
        const endIdx = Math.min(startIdx + BATCH_SIZE, processesToSync.length)
        const batchProcessUniqueIds = processesToSync.slice(startIdx, endIdx)

        // Check if we're approaching timeout (8 minutes)
        const elapsedTime = Date.now() - startTime
        if (elapsedTime > MAX_EXECUTION_TIME) {
          console.log(`Approaching timeout at ${elapsedTime}ms. Saving progress and will auto-retry...`)

          // Save current progress
          await supabaseAdmin
            .from('sync_history')
            .update({
              status: 'failed',
              error_message: `Timeout after processing ${processesProcessed} of ${processesToSync.length} CPS230 processes. Completed ${batchNum - 1} of ${totalBatches} batches. Click Sync Now to resume.`,
              completed_at: new Date().toISOString(),
              records_synced: processesProcessed,
              last_processed_index: startIdx,
              processed_pm_ids: Array.from(syncedProcessIds),
              examined_pm_ids: Array.from(examinedProcessIds),
            })
            .eq('id', syncRecord.id)

          console.log(`Progress saved. Processed ${processesProcessed} CPS230 processes. Next sync will resume from batch ${batchNum}.`)
          return
        }

        console.log(`Processing batch ${batchNum}/${totalBatches} (processes ${startIdx + 1}-${endIdx} of ${processesToSync.length})`)

        // Update batch info
        await supabaseAdmin
          .from('sync_history')
          .update({
            current_batch: batchNum,
            total_batches: totalBatches,
            batch_size: BATCH_SIZE,
          })
          .eq('id', syncRecord.id)

        // Process each process in this batch by unique ID
        for (let i = 0; i < batchProcessUniqueIds.length; i++) {
          const processUniqueId = batchProcessUniqueIds[i]
          const globalIndex = startIdx + i

          // Check if sync was cancelled every 10 processes
          if (i % 10 === 0) {
            const { data: currentSync } = await supabaseAdmin
              .from('sync_history')
              .select('status')
              .eq('id', syncRecord.id)
              .single()

            if (currentSync?.status === 'cancelled') {
              console.log(`Sync cancelled by user at process ${globalIndex}/${processesToSync.length}`)
              await supabaseAdmin
                .from('sync_history')
                .update({
                  completed_at: new Date().toISOString(),
                  records_synced: processesProcessed,
                  last_processed_index: globalIndex,
                  processed_pm_ids: Array.from(syncedProcessIds),
                  examined_pm_ids: Array.from(examinedProcessIds),
                })
                .eq('id', syncRecord.id)
              return // Exit the sync process
            }
          }

          let processDetail: ProcessDetailResponse
          try {
            // Fetch full process details by unique ID
            processDetail = await fetchProcessDetails(config, bearerToken, processUniqueId)

            // Increment total processed count
            totalProcessedCount++

            // Update progress every 10 processes
            if (totalProcessedCount % 10 === 0 || totalProcessedCount === processesToSync.length) {
              console.log(`Progress: ${totalProcessedCount}/${processesToSync.length} CPS230 processes synced`)
              await supabaseAdmin
                .from('sync_history')
                .update({
                  processed_count: totalProcessedCount,
                })
                .eq('id', syncRecord.id)
            }

            // All processes from search have CPS230 tag, no need to check again
          } catch (error: any) {
            console.error(`Failed to fetch process ${globalIndex}/${processesToSync.length} (${processUniqueId}):`, error?.message || error)
            totalProcessedCount++
            continue
          }

        syncedProcessIds.add(processDetail.processJson.Id)
        examinedProcessIds.add(processDetail.processJson.Id)

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

          // Upsert system - check if it already exists first
          const { data: existingSystem } = await supabaseAdmin
            .from('systems')
            .select('id')
            .eq('pm_tag_id', systemTag.id.toString())
            .eq('account_id', profile.account_id)
            .maybeSingle()

          let system
          if (existingSystem) {
            // Update existing system
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
            // Insert new system
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
            processedSystemIds.add(systemTag.id)
            systemsAdded++
          }
        }

        // Upsert process - check if it already exists first
        const { data: existingProcess } = await supabaseAdmin
          .from('processes')
          .select('id')
          .eq('pm_process_id', processDetail.processJson.Id)
          .eq('account_id', profile.account_id)
          .maybeSingle()

        let savedProcess
        let processError

        if (existingProcess) {
          // Update existing process
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
          processError = result.error
        } else {
          // Insert new process
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
          processError = result.error
        }

        if (processError) {
          console.error(`Failed to save process ${processDetail.processJson.Name}:`, processError)
        }

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

        // INCREMENTAL SAVE: Save progress after each batch completes
        console.log(`Completed batch ${batchNum}/${totalBatches}. Saving progress...`)

        // Update sync history with current progress and processed IDs
        await supabaseAdmin
          .from('sync_history')
          .update({
            last_processed_index: endIdx,
            processed_pm_ids: Array.from(syncedProcessIds),
            examined_pm_ids: Array.from(examinedProcessIds),
            records_synced: processesProcessed,
          })
          .eq('id', syncRecord.id)

        console.log(`Batch ${batchNum}/${totalBatches} saved. Processed ${processesProcessed} CPS230 processes.`)
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
