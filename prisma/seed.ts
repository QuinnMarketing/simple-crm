import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@example.com'
  const password = process.env.ADMIN_PASSWORD ?? 'changeme123'

  // Upsert master admin (no accountId, role = master_admin)
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    await prisma.user.update({
      where: { email },
      data: { role: 'master_admin', accountId: null },
    })
    console.log(`✓ Updated ${email} → master_admin`)
  } else {
    await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 12),
        name: 'Master Admin',
        role: 'master_admin',
        accountId: null,
      },
    })
    console.log(`✓ Created master admin: ${email} (password: ${password})`)
    console.log('  Change your password after first login via Settings.')
  }

  // Create a default account if none exist, and migrate unscoped data
  const accountCount = await prisma.account.count()
  if (accountCount === 0) {
    const defaultAccount = await prisma.account.create({
      data: { name: 'Main Account', slug: 'main-account' },
    })
    console.log(`✓ Created default account: Main Account (id: ${defaultAccount.id})`)

    const leadsUpdated = await prisma.lead.updateMany({
      where: { accountId: null },
      data: { accountId: defaultAccount.id },
    })
    const companiesUpdated = await prisma.company.updateMany({
      where: { accountId: null },
      data: { accountId: defaultAccount.id },
    })
    // Migrate existing non-master users to the default account
    const usersUpdated = await prisma.user.updateMany({
      where: { role: { not: 'master_admin' }, accountId: null },
      data: { accountId: defaultAccount.id },
    })

    console.log(`✓ Migrated ${leadsUpdated.count} leads, ${companiesUpdated.count} companies, ${usersUpdated.count} users → Main Account`)
  } else {
    console.log(`ℹ ${accountCount} account(s) already exist — skipping default account creation`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
