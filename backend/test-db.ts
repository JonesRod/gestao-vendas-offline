import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const insts = await prisma.installment.findMany({ take: 5, orderBy: { id: 'desc' } });
  console.log(insts.map(i => ({ id: i.id, saleId: i.saleId, amount: i.amount, punct_disc: i.punctuality_discount_value, loyal_disc: i.loyalty_discount_value })));
  const settings = await prisma.settings.findFirst();
  console.log("Settings:", settings);
}
main().finally(() => prisma.$disconnect());
