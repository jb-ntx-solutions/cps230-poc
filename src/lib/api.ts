import { supabase } from './supabase'
import type { System, Process, Control, CriticalOperation } from '@/types/database'

// Use /data/v1 which will be rewritten by Vercel to Supabase Edge Functions
// This hides the Supabase URL from the client
const API_BASE_URL = '/data/v1'

// Helper function to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('No active session')
  }

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

// Generic fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'An error occurred' }))
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

// ============================================================================
// SYSTEMS API
// ============================================================================

export const systemsApi = {
  getAll: async (): Promise<System[]> => {
    const response = await apiFetch<{ data: System[] }>('systems')
    return response.data
  },

  getById: async (id: string): Promise<System> => {
    const response = await apiFetch<{ data: System }>(`systems?id=${id}`)
    return response.data
  },

  create: async (system: Omit<System, 'id' | 'created_at' | 'modified_date' | 'modified_by'>): Promise<System> => {
    const response = await apiFetch<{ data: System }>('systems', {
      method: 'POST',
      body: JSON.stringify(system),
    })
    return response.data
  },

  update: async (id: string, updates: Partial<Omit<System, 'id' | 'created_at'>>): Promise<System> => {
    const response = await apiFetch<{ data: System }>(`systems?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiFetch<{ success: boolean }>(`systems?id=${id}`, {
      method: 'DELETE',
    })
  },
}

// ============================================================================
// PROCESSES API
// ============================================================================

export interface ProcessWithSystems extends Process {
  systems?: Array<{
    id: string
    system_name: string
  }>
}

export const processesApi = {
  getAll: async (): Promise<ProcessWithSystems[]> => {
    const response = await apiFetch<{ data: ProcessWithSystems[] }>('processes')
    return response.data
  },

  getById: async (id: string): Promise<ProcessWithSystems> => {
    const response = await apiFetch<{ data: ProcessWithSystems }>(`processes?id=${id}`)
    return response.data
  },

  create: async (process: Omit<Process, 'id' | 'created_at' | 'modified_date' | 'modified_by'>): Promise<Process> => {
    const response = await apiFetch<{ data: Process }>('processes', {
      method: 'POST',
      body: JSON.stringify(process),
    })
    return response.data
  },

  update: async (id: string, updates: Partial<Omit<Process, 'id' | 'created_at'>>): Promise<Process> => {
    const response = await apiFetch<{ data: Process }>(`processes?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiFetch<{ success: boolean }>(`processes?id=${id}`, {
      method: 'DELETE',
    })
  },
}

// ============================================================================
// CONTROLS API
// ============================================================================

export const controlsApi = {
  getAll: async (): Promise<Control[]> => {
    const response = await apiFetch<{ data: Control[] }>('controls')
    return response.data
  },

  getById: async (id: string): Promise<Control> => {
    const response = await apiFetch<{ data: Control }>(`controls?id=${id}`)
    return response.data
  },

  create: async (control: Omit<Control, 'id' | 'created_at' | 'modified_date' | 'modified_by'>): Promise<Control> => {
    const response = await apiFetch<{ data: Control }>('controls', {
      method: 'POST',
      body: JSON.stringify(control),
    })
    return response.data
  },

  update: async (id: string, updates: Partial<Omit<Control, 'id' | 'created_at'>>): Promise<Control> => {
    const response = await apiFetch<{ data: Control }>(`controls?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiFetch<{ success: boolean }>(`controls?id=${id}`, {
      method: 'DELETE',
    })
  },
}

// ============================================================================
// CRITICAL OPERATIONS API
// ============================================================================

export const criticalOperationsApi = {
  getAll: async (): Promise<CriticalOperation[]> => {
    const response = await apiFetch<{ data: CriticalOperation[] }>('critical-operations')
    return response.data
  },

  getById: async (id: string): Promise<CriticalOperation> => {
    const response = await apiFetch<{ data: CriticalOperation }>(`critical-operations?id=${id}`)
    return response.data
  },

  create: async (operation: Omit<CriticalOperation, 'id' | 'created_at' | 'modified_date' | 'modified_by'>): Promise<CriticalOperation> => {
    const response = await apiFetch<{ data: CriticalOperation }>('critical-operations', {
      method: 'POST',
      body: JSON.stringify(operation),
    })
    return response.data
  },

  update: async (id: string, updates: Partial<Omit<CriticalOperation, 'id' | 'created_at'>>): Promise<CriticalOperation> => {
    const response = await apiFetch<{ data: CriticalOperation }>(`critical-operations?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiFetch<{ success: boolean }>(`critical-operations?id=${id}`, {
      method: 'DELETE',
    })
  },
}
