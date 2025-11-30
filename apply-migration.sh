#!/bin/bash
# Script to apply the database migration using Supabase CLI

echo "==================================================================="
echo "Database Migration Script"
echo "==================================================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo "Install it with: brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI found: $(supabase --version)"
echo ""

# Check if authenticated
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "⚠️  Not authenticated with Supabase"
    echo ""
    echo "Please authenticate first:"
    echo "  Option 1: Run 'supabase login' and follow the prompts"
    echo "  Option 2: Set SUPABASE_ACCESS_TOKEN environment variable"
    echo ""
    echo "To get an access token:"
    echo "  1. Go to: https://supabase.com/dashboard/account/tokens"
    echo "  2. Generate a new token"
    echo "  3. Run: export SUPABASE_ACCESS_TOKEN='your-token-here'"
    echo ""
    exit 1
fi

echo "✅ Authenticated with Supabase"
echo ""

# Link to project if not already linked
PROJECT_REF="rdqavrqfisyzwfqhckcp"
echo "Linking to project: $PROJECT_REF"
supabase link --project-ref $PROJECT_REF

if [ $? -ne 0 ]; then
    echo "❌ Failed to link to project"
    exit 1
fi

echo ""
echo "==================================================================="
echo "Applying migration: add_regions_to_processes.sql"
echo "==================================================================="
echo ""

# Apply the migration
supabase db push

if [ $? -eq 0 ]; then
    echo ""
    echo "==================================================================="
    echo "✅ Migration applied successfully!"
    echo "==================================================================="
    echo ""
    echo "The following columns were added:"
    echo "  - processes.account_id (UUID)"
    echo "  - processes.regions (TEXT[])"
    echo "  - critical_operations.account_id (UUID)"
    echo "  - controls.account_id (UUID)"
    echo "  - systems.account_id (UUID)"
    echo ""
    echo "You can now:"
    echo "  ✅ Assign regions to processes"
    echo "  ✅ Create critical operations"
    echo "  ✅ Create controls"
    echo ""
else
    echo ""
    echo "==================================================================="
    echo "❌ Migration failed"
    echo "==================================================================="
    echo ""
    echo "Please apply the migration manually:"
    echo "  1. Go to: https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new"
    echo "  2. Copy the SQL from: apply-regions-migration.sql"
    echo "  3. Run it in the SQL editor"
    echo ""
    exit 1
fi
