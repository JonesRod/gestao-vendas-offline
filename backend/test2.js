const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.saleItem.findMany({ orderBy: { id: 'desc' }, take: 5 }).then(console.log).finally(() => prisma.$disconnect());
