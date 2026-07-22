import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@plato/ui', '@plato/config', '@plato/schema', '@plato/auth'],
}

export default nextConfig
