import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, getCorsHeaders } from '../_shared/cors.ts'
import { authenticateUser } from '../_shared/auth.ts'
import { validateUserProfileInput, ValidationError } from '../_shared/validation.ts'

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
    const userId = url.searchParams.get('user_id')

    switch (req.method) {
      case 'GET': {
        if (id) {
          // Get single user profile by profile ID
          const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', id)
            .single()

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          })
        } else if (userId) {
          // Get user profile by user_id
          const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single()

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          })
        } else {
          // Get all user profiles (filtered by account via RLS)
          // Get current user's profile to find account_id
          const { data: currentProfile, error: profileError } = await supabaseClient
            .from('user_profiles')
            .select('account_id')
            .eq('user_id', user.id)
            .single()

          if (profileError || !currentProfile) {
            throw new Error('User profile not found')
          }

          const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('account_id', currentProfile.account_id)
            .order('created_at', { ascending: false })

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          })
        }
      }

      case 'PATCH': {
        // Update user profile
        if (!id) {
          throw new Error('Profile ID is required for update')
        }

        const body = await req.json()

        // Validate and whitelist input fields
        const validatedData = validateUserProfileInput(body)

        const { data, error } = await supabaseClient
          .from('user_profiles')
          .update(validatedData)
          .eq('id', id)
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify({ data }), {
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        })
      }

      case 'DELETE': {
        // Delete user profile (admin only)
        if (!id) {
          throw new Error('Profile ID is required for delete')
        }

        // Verify user is promaster
        const { data: profile } = await supabaseClient
          .from('user_profiles')
          .select('role')
          .eq('user_id', user.id)
          .single()

        if (profile?.role !== 'promaster') {
          throw new Error('Only Promasters can delete users')
        }

        const { error } = await supabaseClient
          .from('user_profiles')
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
