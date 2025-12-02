// SECURITY: Whitelist allowed origins instead of allowing all (*)
const getAllowedOrigins = (): string[] => {
  const allowedOrigins = [
    // Production URL
    'https://cps230.ntx-poc.com',
    'https://cps230-ntx-poc.vercel.app',
  ]

  // Add localhost for development
  if (Deno.env.get('ENVIRONMENT') !== 'production') {
    allowedOrigins.push('http://localhost:5173')
    allowedOrigins.push('http://localhost:8080')
    allowedOrigins.push('http://localhost:8081')
  }

  // Allow custom frontend URL from environment
  const customUrl = Deno.env.get('FRONTEND_URL')
  if (customUrl) {
    allowedOrigins.push(customUrl)
  }

  return allowedOrigins
}

/**
 * Get CORS headers for a specific origin
 * Only allows whitelisted origins
 */
export function getCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigins = getAllowedOrigins()
  const isAllowed = origin && allowedOrigins.includes(origin)

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  }
}

// Legacy export for backward compatibility (will be removed)
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // ⚠️ DEPRECATED - Use getCorsHeaders() instead
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
