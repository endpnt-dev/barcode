import { NextRequest } from 'next/server'
import { ApiTier } from './config'

export interface ApiKey {
  tier: ApiTier
  name: string
}

export interface ApiKeys {
  [key: string]: ApiKey
}

export interface AuthResult {
  valid: boolean
  message: string
  apiKey?: ApiKey
}

export function validateApiKey(request: NextRequest): AuthResult {
  const key = getApiKeyFromHeaders(request.headers)

  if (!key) {
    return { valid: false, message: 'API key required in x-api-key header' }
  }

  // Check if key has the correct prefix
  if (!key.startsWith('ek_')) {
    return { valid: false, message: 'Invalid API key format' }
  }

  try {
    const apiKeysJson = process.env.API_KEYS
    if (!apiKeysJson) {
      console.error('API_KEYS environment variable not set')
      return { valid: false, message: 'Authentication service unavailable' }
    }

    const apiKeys: ApiKeys = JSON.parse(apiKeysJson)
    const keyInfo = apiKeys[key]

    if (!keyInfo) {
      return { valid: false, message: 'Invalid API key' }
    }

    return { valid: true, message: 'Valid API key', apiKey: keyInfo }
  } catch (error) {
    console.error('Failed to parse API_KEYS:', error)
    return { valid: false, message: 'Authentication service unavailable' }
  }
}

export function getApiKeyFromHeaders(headers: Headers): string | null {
  const key = headers.get('x-api-key')
  return key ? key.trim() : null
}