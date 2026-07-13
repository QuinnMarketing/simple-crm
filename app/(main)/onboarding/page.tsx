import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import OnboardingWizard from './OnboardingWizard'

export const metadata = { title: 'Get started' }

export default async function OnboardingPage() {
  const session = await auth()
  if (!session) redirect('/login')

  // Master admins have no single account to onboard.
  const accountId = session.user.accountId
  if (!accountId) redirect('/')

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      name: true,
      businessPhone: true,
      businessAddress: true,
      abn: true,
    },
  })
  if (!account) redirect('/')

  return (
    <OnboardingWizard
      accountId={account.id}
      businessName={account.name}
      initial={{
        businessPhone: account.businessPhone ?? '',
        businessAddress: account.businessAddress ?? '',
        abn: account.abn ?? '',
      }}
    />
  )
}
