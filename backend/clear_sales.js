const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.installment.deleteMany({});
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});
  
  await prisma.customer.updateMany({
    data: { credit_used: 0 }
  });
  
  console.log('All sales and installments deleted');
}

main().catch(console.error).finally(() => prisma.$disconnect());
