import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { searchStockImages } from '@/lib/stock-images'

// Authenticated wrapper around the Pexels stock-photo search already used
// for AI landing pages — lets other admin flows (gallery/product/blog image
// picking) find imagery without any route needing direct access to
// PEXELS_API_KEY itself.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = req.nextUrl.searchParams.get('q') ?? ''
  const count = Math.min(parseInt(req.nextUrl.searchParams.get('count') ?? '8', 10) || 8, 20)
  if (!query.trim()) return NextResponse.json({ error: 'q required' }, { status: 400 })

  const urls = await searchStockImages(query, count)
  return NextResponse.json({ urls })
}
