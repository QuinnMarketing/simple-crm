import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ChatWidget from './ChatWidget'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const account = await prisma.account.findUnique({ where: { slug }, select: { name: true } })
  return {
    title: account ? `Chat with ${account.name}` : 'Live Chat',
    robots: { index: false, follow: false },
  }
}

export default async function ChatPage({ params }: Props) {
  const { slug } = await params
  const account = await prisma.account.findUnique({
    where: { slug, isActive: true },
    select: { name: true, slug: true },
  })
  if (!account) notFound()

  return <ChatWidget slug={account.slug} businessName={account.name} />
}
