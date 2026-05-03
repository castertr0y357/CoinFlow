import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } })
  console.log("Current Token:", settings?.simpleFinToken ? settings.simpleFinToken.substring(0, 20) + "..." : "NONE")
}

main()
