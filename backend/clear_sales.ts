import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.saleItem.deleteMany({});
  await prisma.installment.deleteMany({});
  await prisma.sale.deleteMany({});
  console.log('All sales cleared');
}

main().catch(console.error).finally(() => prisma.$disconnect());
