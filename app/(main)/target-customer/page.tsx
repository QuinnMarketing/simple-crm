import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import TargetCustomerManager from './TargetCustomerManager'

export default async function TargetCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { account } = await searchParams
  const accountId = session.user.role === 'master_admin' ? (account ?? null) : (session.user.accountId ?? null)

  return <TargetCustomerManager accountId={accountId} />
}
