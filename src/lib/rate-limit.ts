/**
 * Distributed rate limiter using Upstash Redis.
 *
 * Uses a sliding window algorithm that is shared across all Vercel serverless
 * invocations — accurate and abuse-proof at any scale.
 *
 * Requires env vars:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Falls back to allow-all if env vars are missing (e.g. local dev without Redis).
 * Set those vars in .env.local for local rate-limit testing.
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Cache Ratelimit instances per config key so we don't recreate on every request
const instanceCache = new Map<string, Ratelimit>()

function getRatelimiter(limit: number, windowSeconds: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const cacheKey = `${limit}:${windowSeconds}`
  if (instanceCache.has(cacheKey)) return instanceCache.get(cacheKey)!

  const redis = new Redis({ url, token })
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: false,
  })
  instanceCache.set(cacheKey, limiter)
  return limiter
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number
  /** Window duration in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given identifier (typically IP + route).
 *
 * @example
 * const ip = getClientIp(request)
 * const { success } = await checkRateLimit(`${ip}:/api/approvals`, { limit: 20, windowSeconds: 60 })
 * if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const limiter = getRatelimiter(config.limit, config.windowSeconds)

  // No Redis configured — allow all (local dev without .env.local)
  if (!limiter) {
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit,
      resetAt: Date.now() + config.windowSeconds * 1000,
    }
  }

  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.reset,
  }
}

/**
 * Helper to extract client IP from Next.js request headers.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  )
}
