import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create a Supabase client with the user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Create admin client for creating users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if the current user is a Promaster
    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('role, account_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('User profile not found')
    }

    if (profile.role !== 'promaster') {
      throw new Error('Only Promasters can create users')
    }

    // Parse the request body
    const { email, password, full_name, role, account_id } = await req.json()

    // Validate inputs
    if (!email || !password) {
      throw new Error('Email and password are required')
    }

    // Ensure the user is creating accounts in their own account
    if (account_id && account_id !== profile.account_id) {
      throw new Error('You can only create users in your own account')
    }

    const targetAccountId = account_id || profile.account_id

    // Create the auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || null,
      },
    })

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`)
    }

    if (!authData.user) {
      throw new Error('Failed to create user')
    }

    // Create the user profile
    const { error: profileInsertError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        email: email,
        full_name: full_name || null,
        role: role || 'user',
        account_id: targetAccountId,
      })

    if (profileInsertError) {
      // If profile creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw new Error(`Failed to create user profile: ${profileInsertError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
