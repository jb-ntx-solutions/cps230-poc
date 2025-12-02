import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, getCorsHeaders } from '../_shared/cors.ts'
import { authenticateUser, createAdminClient } from '../_shared/auth.ts'
import { validateEmail, sanitizeString, ValidationError } from '../_shared/validation.ts'

serve(async (req) => {
  const origin = req.headers.get('origin')

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) })
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
    const body = await req.json()

    // Validate and sanitize inputs
    if (!body.email || !body.password) {
      throw new Error('Email and password are required')
    }

    if (!validateEmail(body.email)) {
      throw new ValidationError('Invalid email format')
    }

    const email = sanitizeString(body.email, 255)
    const password = body.password
    const full_name = body.full_name ? sanitizeString(body.full_name, 255) : null
    const role = ['promaster', 'basic'].includes(body.role) ? body.role : 'basic'

    // Ensure the user is creating accounts in their own account
    // Always use the current user's account_id, ignore account_id from request
    const targetAccountId = profile.account_id

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
        full_name: full_name,
        role: role,
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
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    const status = error instanceof ValidationError ? 400 :
                   error.message === 'Unauthorized' ? 401 :
                   error.message?.includes('Only Promasters') ? 403 : 500

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred',
      }),
      {
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        status,
      }
    )
  }
})
