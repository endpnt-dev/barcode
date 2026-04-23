import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { TIER_LIMITS, ApiTier } from './config'

let redis: Redis | null = null
let rateLimiters: Record<ApiTier, Ratelimit> | null = null

function initializeRedis() {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
      console.warn('Redis credentials not found. Rate limiting disabled.')
      return null
    }

    redis = new Redis({
      url,
      token,
    })
  }
  return redis
}

function initializeRateLimiters() {
  if (!rateLimiters) {
    const redisInstance = initializeRedis()
    if (!redisInstance) return null

    rateLimiters = {
      free: new Ratelimit({
        redis: redisInstance,
        limiter: Ratelimit.slidingWindow(
          TIER_LIMITS.free.requests_per_minute,
          '1 m'
        ),
        analytics: true,
        prefix: 'endpnt:ratelimit:barcode:free',
      }),
      starter: new Ratelimit({
        redis: redisInstance,
        limiter: Ratelimit.slidingWindow(
          TIER_LIMITS.starter.requests_per_minute,
          '1 m'
        ),
        analytics: true,
        prefix: 'endpnt:ratelimit:barcode:starter',
      }),
      pro: new Ratelimit({
        redis: redisInstance,
        limiter: Ratelimit.slidingWindow(
          TIER_LIMITS.pro.requests_per_minute,
          '1 m'
        ),
        analytics: true,
        prefix: 'endpnt:ratelimit:barcode:pro',
      }),
      enterprise: new Ratelimit({
        redis: redisInstance,
        limiter: Ratelimit.slidingWindow(
          TIER_LIMITS.enterprise.requests_per_minute,
          '1 m'
        ),
        analytics: true,
        prefix: 'endpnt:ratelimit:barcode:enterprise',
      }),
    }
  }
  return rateLimiters
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reset: number
  limit: number
}

export async function checkRateLimit(
  identifier: string,
  tier: ApiTier
): Promise<RateLimitResult> {
  const limiters = initializeRateLimiters()

  if (!limiters) {
    // If Redis is not available, allow all requests
    console.warn('Rate limiting disabled: Redis not available')
    return {
      allowed: true,
      remaining: TIER_LIMITS[tier].requests_per_minute,
      reset: Date.now() + 60000,
      limit: TIER_LIMITS[tier].requests_per_minute,
    }
  }

  try {
    const result = await limiters[tier].limit(identifier)

    return {
      allowed: result.success,
      remaining: result.remaining,
      reset: result.reset,
      limit: result.limit,
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // On error, allow the request but log the issue
    return {
      allowed: true,
      remaining: TIER_LIMITS[tier].requests_per_minute,
      reset: Date.now() + 60000,
      limit: TIER_LIMITS[tier].requests_per_minute,
    }
  }
}