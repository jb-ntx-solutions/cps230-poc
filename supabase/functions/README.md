# Supabase Edge Functions

This directory contains Supabase Edge Functions for the CPS230 application.

## create-user

This edge function allows Promaster administrators to create new users directly from the Users management page.

### Deployment

To deploy this edge function to your Supabase project:

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref rdqavrqfisyzwfqhckcp

# Deploy the function
supabase functions deploy create-user
```

### Testing Locally

```bash
# Serve functions locally
supabase functions serve create-user

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/create-user' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@example.com","password":"password123","full_name":"Test User","role":"user"}'
```

### Environment Variables

The edge function requires the following environment variables (automatically available in Supabase):
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (set automatically)

### Security

- Only authenticated users can call this function
- Only users with the 'promaster' role can create new users
- Users can only create accounts within their own account/organization
- The function validates all inputs before creating users
- If user profile creation fails, the auth user is automatically deleted (rollback)
