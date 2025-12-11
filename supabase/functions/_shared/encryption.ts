/**
 * Encryption utilities for sensitive data
 * Uses Web Crypto API available in Deno
 */

const ENCRYPTION_KEY_ENV = 'ENCRYPTION_KEY'

/**
 * Get or generate encryption key from environment
 * In production, this should be a securely stored 32-byte key
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get(ENCRYPTION_KEY_ENV)

  if (!keyString) {
    throw new Error('ENCRYPTION_KEY environment variable not set')
  }

  // Convert base64 key to bytes
  const keyBytes = base64ToBytes(keyString)

  if (keyBytes.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (256 bits)')
  }

  // Import key for AES-GCM encryption
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt a string value using AES-GCM
 * Returns base64-encoded encrypted data with IV prepended
 */
export async function encryptValue(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext

  const key = await getEncryptionKey()

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Encrypt the data
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )

  const encryptedBytes = new Uint8Array(encryptedBuffer)

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encryptedBytes.length)
  combined.set(iv, 0)
  combined.set(encryptedBytes, iv.length)

  // Return as base64
  return bytesToBase64(combined)
}

/**
 * Decrypt a base64-encoded encrypted value
 * Expects IV to be prepended to encrypted data
 */
export async function decryptValue(encrypted: string): Promise<string> {
  if (!encrypted) return encrypted

  const key = await getEncryptionKey()

  // Decode base64
  const combined = base64ToBytes(encrypted)

  // Extract IV (first 12 bytes) and encrypted data
  const iv = combined.slice(0, 12)
  const encryptedBytes = combined.slice(12)

  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBytes
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedBuffer)
}

/**
 * Check if a value appears to be encrypted (base64 format)
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false

  // Check if it's valid base64 and longer than plain IV (12 bytes = 16 chars base64)
  const base64Regex = /^[A-Za-z0-9+/]+=*$/
  return base64Regex.test(value) && value.length > 16
}

/**
 * Determine if a setting key should be encrypted
 */
export function shouldEncrypt(key: string): boolean {
  const sensitiveKeys = [
    'nintex_password',
    'pm_password',
    'pm_username',
    'pm_tenant_id',
    'api_key',
    'secret',
    'token',
    'credential'
  ]

  return sensitiveKeys.some(sensitiveKey =>
    key.toLowerCase().includes(sensitiveKey)
  )
}

// Helper functions for base64 encoding/decoding
function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) =>
    String.fromCodePoint(byte),
  ).join('')
  return btoa(binString)
}

function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64)
  return Uint8Array.from(binString, (char) => char.codePointAt(0)!)
}

/**
 * Generate a new encryption key (for setup/rotation)
 * Returns a base64-encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32))
  return bytesToBase64(key)
}
