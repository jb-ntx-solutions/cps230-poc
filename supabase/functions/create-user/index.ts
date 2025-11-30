import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { authenticateUser, createAdminClient } from '../_shared/auth.ts'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const { user, supabaseClient } = await authenticateUser(authHeader)

    // Create admin client for creating users
    const supabaseAdmin = createAdminClient()

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
