import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'

const TRIAL_DAYS = 14
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Turn a business name into a URL-safe slug base. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** Find an available, unique slug derived from the business name. */
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'account'
  let candidate = base
  for (let i = 0; i < 50; i++) {
    const existing = await prisma.account.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!existing) return candidate
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`
  }
  // Extremely unlikely fallback
  return `${base}-${Date.now().toString(36)}`
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  // Coarse per-IP limit to blunt automated abuse.
  if (!rateLimit(`signup:ip:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const signupSourceRaw =
    (typeof body.signupSource === 'string' && body.signupSource.trim()) ||
    (typeof body.source === 'string' && body.source.trim()) ||
    req.nextUrl.searchParams.get('source') ||
    req.nextUrl.searchParams.get('utm_source') ||
    null
  const signupSource = signupSourceRaw ? String(signupSourceRaw).slice(0, 120) : null

  // Validation
  if (!businessName) return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Your name is required' }, { status: 400 })
  if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  // Per-email limit (stops hammering a single address).
  if (!rateLimit(`signup:email:${email}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists. Try signing in instead.' }, { status: 409 })
  }

  const slug = await uniqueSlug(businessName)
  const passwordHash = await bcrypt.hash(password, 12)
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

  try {
    await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: businessName,
          slug,
          subscriptionStatus: 'trialing',
          trialEndsAt,
          signupSource,
          bookingSettings: { create: {} }, // sensible defaults; deep config lives in Settings
        },
        select: { id: true },
      })

      await tx.user.create({
        data: {
          email,
          name,
          password: passwordHash,
          role: 'account_admin',
          accountId: account.id,
          userAccounts: { create: { accountId: account.id } },
        },
      })
    })
  } catch (e) {
    // Unique-constraint race (email/slug) → surface as conflict; otherwise generic.
    const code = (e as { code?: string })?.code
    if (code === 'P2002') {
      return NextResponse.json({ error: 'An account with that email already exists. Try signing in instead.' }, { status: 409 })
    }
    console.error('Signup failed:', e)
    return NextResponse.json({ error: 'Could not create your account. Please try again.' }, { status: 500 })
  }

  // Client completes login via signIn('credentials', ...).
  return NextResponse.json({ ok: true })
}
