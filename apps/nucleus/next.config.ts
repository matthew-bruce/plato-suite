import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@plato/ui', '@plato/schema', '@plato/auth', 'lucide-react'],
}

export default nextConfig
