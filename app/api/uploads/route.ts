import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { auth } from '@/auth'

const MAX_BYTES = 8 * 1024 * 1024 // 8MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

// Generic authenticated image upload for account-owned media (gallery
// photos, featured product images). Stores to the shared public Vercel Blob
// store; callers persist the returned URL on their own row.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 })

  const ext = file.type.split('/')[1]
  const key = `uploads/${session.user.accountId ?? 'shared'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const blob = await put(key, file, { access: 'public', contentType: file.type })
  return NextResponse.json({ url: blob.url })
}
