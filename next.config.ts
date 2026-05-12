import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingIncludes: {
    '**': ['./node_modules/pdfkit/js/data/**/*'],
  },
}

export default nextConfig
