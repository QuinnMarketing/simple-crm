import { prisma } from './prisma'

const SKIP = new Set(['id', 'accountId', 'createdAt', 'updatedAt', 'password', 'webhookToken'])

export function auditDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, [unknown, unknown]> | null {
  const changes: Record<string, [unknown, unknown]> = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)].filter((k) => !SKIP.has(k)))
  for (const key of keys) {
    const a = JSON.stringify(before[key])
    const b = JSON.stringify(after[key])
    if (a !== b) changes[key] = [before[key], after[key]]
  }
  return Object.keys(changes).length ? changes : null
}

export async function logAudit(params: {
  accountId?: string | null
  userId?: string | null
  userEmail?: string | null
  action: string
  entityType: string
  entityId: string
  entityLabel?: string | null
  changes?: Record<string, unknown> | null
  ipAddress?: string | null
}) {
  try {
    await prisma.auditLog.create({
      data: {
        accountId: params.accountId ?? null,
        userId: params.userId ?? null,
        userEmail: params.userEmail ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityLabel: params.entityLabel ?? null,
        changes: params.changes ? JSON.stringify(params.changes) : null,
        ipAddress: params.ipAddress ?? null,
      },
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }
}

export function getIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null
  )
}
