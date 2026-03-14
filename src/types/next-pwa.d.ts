declare module "next-pwa" {
  import type { NextConfig } from "next"

  interface PWAConfig {
    dest?: string
    disable?: boolean
    register?: boolean
    skipWaiting?: boolean
    sw?: string
    scope?: string
    cacheOnFrontEndNav?: boolean
    reloadOnOnline?: boolean
    [key: string]: unknown
  }

  export default function withPWAInit(
    config: PWAConfig
  ): (nextConfig: NextConfig) => NextConfig
}
