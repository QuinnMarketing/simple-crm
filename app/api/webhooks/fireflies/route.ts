import { prisma } from '@/lib/prisma'
import { getTranscript } from '@/lib/fireflies'
import { sendPushToAccount } from '@/lib/push'
import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const REF_PATTERN = /\[ref:([a-f0-9]+)\]/

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.FIREFLIES_WEBHOOK_SECRET
  if (!secret || !signatureHeader) return false
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature')

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { event?: string; meeting_id?: string }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true }) // ack malformed bodies rather than making Fireflies retry forever
  }

  if (payload.event !== 'meeting.transcribed' || !payload.meeting_id) {
    return NextResponse.json({ ok: true })
  }

  const transcript = await getTranscript(payload.meeting_id).catch((e) => {
    console.error('Fireflies transcript fetch failed:', e)
    return null
  })
  if (!transcript) return NextResponse.json({ ok: true })

  // Only meetings started via the "Start Fireflies Recording" button carry
  // this ref in their title — untagged meetings (e.g. unrelated team
  // meetings on the same shared Fireflies account) are ignored here
  const match = transcript.title.match(REF_PATTERN)
  if (!match) return NextResponse.json({ ok: true })

  const appointment = await prisma.appointment.findFirst({
    where: { firefliesRef: match[1] },
    include: { assignedTo: { select: { name: true } } },
  })
  if (!appointment) return NextResponse.json({ ok: true })

  const summary = transcript.summary?.overview
    || transcript.summary?.shorthand_bullet?.join('\n')
    || 'Fireflies transcript available — no summary generated'

  await prisma.timeEntry.create({
    data: {
      type: 'meeting',
      description: summary,
      durationMin: Math.max(1, Math.round(transcript.duration / 60)),
      startedAt: appointment.startTime,
      assignedTo: appointment.assignedTo?.name ?? null,
      leadId: appointment.leadId,
      accountId: appointment.accountId,
    },
  })

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { firefliesStatus: 'recorded' },
  })

  if (appointment.accountId) {
    await sendPushToAccount(appointment.accountId, {
      title: '🎙️ Meeting transcribed',
      body: `Time entry logged automatically for "${appointment.title}"`,
      url: appointment.leadId ? `/leads/${appointment.leadId}` : '/calendar',
    })
  }

  return NextResponse.json({ ok: true })
}
