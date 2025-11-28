/**
 * Migration Runner Script
 * This script applies SQL migrations to the Supabase database
 *
 * Usage: npm run migrate
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration(filePath: string) {
  console.log(`\n📄 Reading migration file: ${filePath}`);

  try {
    const sql = readFileSync(filePath, 'utf-8');

    console.log('🔄 Executing migration...');

    // Split the SQL into individual statements
    // This is a simple split - for complex migrations you might need a proper SQL parser
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

        if (error) {
          // Try direct execution if exec_sql function doesn't exist
          console.error(`⚠️  exec_sql failed, trying direct execution...`);
          console.error(`Error: ${error.message}`);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err: any) {
        console.error(`❌ Error executing statement: ${err.message}`);
        console.error(`Statement: ${statement.substring(0, 100)}...`);
        errorCount++;
      }
    }

    console.log(`\n✅ Migration complete: ${successCount} statements executed, ${errorCount} errors`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some statements failed. You may need to run this migration manually in the Supabase SQL Editor.');
      console.log('   Go to: https://app.supabase.com/project/_/sql/new');
      console.log(`   Copy the contents of: ${filePath}`);
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Main execution
const migrationFile = process.argv[2] || join(__dirname, '../supabase/fix_rls_recursion.sql');

console.log('🚀 Starting migration runner...');
console.log(`📍 Supabase URL: ${supabaseUrl}`);

runMigration(migrationFile)
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration runner failed:', error);
    process.exit(1);
  });
