#!/usr/bin/env -S deno run --allow-env --allow-net

/**
 * Setup script for encryption key generation
 * Run this once to generate an encryption key for the settings table
 *
 * Usage:
 *   deno run --allow-env --allow-net supabase/functions/setup-encryption.ts
 */

// Generate encryption key
function generateEncryptionKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32))
  const binString = Array.from(key, (byte) =>
    String.fromCodePoint(byte),
  ).join('')
  return btoa(binString)
}

console.log('='.repeat(80))
console.log('🔐 Encryption Key Setup for Settings Table')
console.log('='.repeat(80))
console.log('')

const encryptionKey = generateEncryptionKey()

console.log('✅ Generated 256-bit AES-GCM encryption key')
console.log('')
console.log('📋 Add this to your Supabase Edge Functions secrets:')
console.log('')
console.log(`   supabase secrets set ENCRYPTION_KEY="${encryptionKey}"`)
console.log('')
console.log('📋 For local development, add to .env.local:')
console.log('')
console.log(`   ENCRYPTION_KEY=${encryptionKey}`)
console.log('')
console.log('⚠️  IMPORTANT:')
console.log('   - Store this key securely (1Password, AWS Secrets Manager, etc.)')
console.log('   - Never commit this key to git')
console.log('   - If you lose this key, encrypted data cannot be recovered')
console.log('   - Rotate this key periodically (every 90 days)')
console.log('')
console.log('🔄 To set the secret in Supabase (requires Supabase CLI):')
console.log('')
console.log('   1. Make sure you are logged in:')
console.log('      supabase login')
console.log('')
console.log('   2. Link your project (if not already linked):')
console.log('      supabase link --project-ref rdqavrqfisyzwfqhckcp')
console.log('')
console.log('   3. Set the encryption key:')
console.log(`      supabase secrets set ENCRYPTION_KEY="${encryptionKey}"`)
console.log('')
console.log('✅ After setting the secret, redeploy the settings Edge Function:')
console.log('   supabase functions deploy settings')
console.log('')
console.log('='.repeat(80))
console.log('📝 The following settings will be automatically encrypted:')
console.log('   - nintex_password')
console.log('   - Any key containing: api_key, secret, token, credential')
console.log('='.repeat(80))
