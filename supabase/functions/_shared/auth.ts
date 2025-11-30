import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

export async function authenticateUser(authHeader: string | null) {
  if (!authHeader) {
    throw new Error('Missing authorization header')
  }

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

  // Verify user
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

  if (userError || !user) {
    throw new Error('Unauthorized')
  }

  return { user, supabaseClient }
}

export function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
