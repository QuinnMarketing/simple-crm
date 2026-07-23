import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { searchStockVideos } from '@/lib/stock-images'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = req.nextUrl.searchParams.get('q') ?? ''
  const count = Math.min(parseInt(req.nextUrl.searchParams.get('count') ?? '6', 10) || 6, 15)
  if (!query.trim()) return NextResponse.json({ error: 'q required' }, { status: 400 })

  const videos = await searchStockVideos(query, count)
  return NextResponse.json({ videos })
}
