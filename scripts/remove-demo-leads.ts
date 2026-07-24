// Deletes every lead created by scripts/seed-demo-leads.ts (identified by
// the DEMO_TAG marker in `notes`). Safe to run any time after the demo.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DEMO_TAG = '[DEMO SEED — safe to delete]'

async function main() {
  const result = await prisma.lead.deleteMany({
    where: { notes: { contains: DEMO_TAG } },
  })
  console.log(`Deleted ${result.count} demo leads.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
