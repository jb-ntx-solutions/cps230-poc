# Supabase Database Setup

This directory contains the database schema and configuration for the CPS230 Critical Operations application.

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

### 2. Run the Schema

1. Go to the SQL Editor in your Supabase dashboard
2. Copy the contents of `schema.sql`
3. Paste and run the SQL script

This will create:
- All necessary tables (processes, systems, critical_operations, controls, user_profiles, settings)
- Row Level Security (RLS) policies
- Triggers and functions
- Initial seed data

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the values in `.env`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. User Roles

The application supports three user roles:

- **user**: Can view all data
- **business_analyst**: Can view and edit processes on the canvas
- **promaster**: Full admin access (can manage users, settings, all data)

The first user to sign up will need to be manually promoted to `promaster` role via the Supabase dashboard:

```sql
UPDATE public.user_profiles
SET role = 'promaster'
WHERE email = 'your-admin-email@example.com';
```

## Database Schema Overview

### Core Tables

- **user_profiles**: Extended user information and roles
- **processes**: Business processes from Nintex Process Manager
- **systems**: Systems/applications used in processes
- **process_systems**: Many-to-many mapping of processes to systems
- **critical_operations**: CPS230 critical operations
- **controls**: Controls for managing critical operations
- **settings**: Application settings (Nintex API config, etc.)
- **sync_history**: Logs of Nintex synchronization events

### Security

All tables have Row Level Security (RLS) enabled with appropriate policies:
- Authenticated users can view most data
- Business Analysts can edit processes
- Promasters have full access to all tables
- Settings are only accessible to Promasters
