import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes for Customers
app.get('/api/customers', async (req, res) => {
  const customers = await prisma.customer.findMany();
  res.json(customers);
});

app.post('/api/customers', async (req, res) => {
  const customer = await prisma.customer.create({ data: req.body });
  res.json(customer);
});

app.put('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  const customer = await prisma.customer.update({
    where: { id: Number(id) },
    data: req.body
  });
  res.json(customer);
});

app.delete('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.customer.delete({ where: { id: Number(id) } });
  res.json({ success: true });
});

// Routes for Products
app.get('/api/products', async (req, res) => {
  const products = await prisma.product.findMany({ include: { kitItemsParent: true } });
  res.json(products.map(p => ({
    ...p,
    images: p.images ? JSON.parse(p.images) : [],
    kit_items: p.kitItemsParent?.map(k => ({ productId: k.childProductId, quantity: k.quantity })) || []
  })));
});

app.post('/api/products', async (req, res) => {
  const { kit_items, images, ...rest } = req.body;
  const data: any = { ...rest };
  if (images && Array.isArray(images)) {
    data.images = JSON.stringify(images);
  } else {
    data.images = JSON.stringify([]);
  }
  
  if (kit_items && kit_items.length > 0) {
     data.kitItemsParent = {
        create: kit_items.map((k: any) => ({
           childProductId: k.productId,
           quantity: k.quantity
        }))
     };
  }

  try {
    const product = await prisma.product.create({ data, include: { kitItemsParent: true } });
    res.json({
       ...product,
       images: JSON.parse(product.images || '[]'),
       kit_items: product.kitItemsParent?.map(k => ({ productId: k.childProductId, quantity: k.quantity })) || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { kit_items, images, ...rest } = req.body;
  const data: any = { ...rest };
  if (images && Array.isArray(images)) {
    data.images = JSON.stringify(images);
  }
  
  try {
    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: {
         ...data,
         kitItemsParent: kit_items ? {
            deleteMany: {},
            create: kit_items.map((k: any) => ({
               childProductId: k.productId,
               quantity: k.quantity
            }))
         } : undefined
      },
      include: { kitItemsParent: true }
    });
    res.json({
       ...product,
       images: JSON.parse(product.images || '[]'),
       kit_items: product.kitItemsParent?.map((k: any) => ({ productId: k.childProductId, quantity: k.quantity })) || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  // Exclui os itens do kit antes para evitar erro de foreign key constraint
  await prisma.kitItem.deleteMany({ where: { parentProductId: Number(id) } });
  await prisma.kitItem.deleteMany({ where: { childProductId: Number(id) } });
  
  await prisma.product.delete({ where: { id: Number(id) } });
  res.json({ success: true });
});

// Routes for Sales
app.get('/api/sales', async (req, res) => {
  const sales = await prisma.sale.findMany({ include: { items: { include: { product: true } }, installments: true } });
  res.json(sales);
});

app.post('/api/sales', async (req, res) => {
  const { items, installments, ...saleData } = req.body;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          ...saleData,
          items: {
            create: items || []
          }
        }
      });

      if (installments && installments.length > 0) {
        const installmentsToCreate = installments.map((inst: any) => ({
          ...inst,
          saleId: sale.id
        }));
        await tx.installment.createMany({
          data: installmentsToCreate
        });
      }

      if (saleData.customerId && saleData.paymentMethod === 'credit') {
         const customer = await tx.customer.findUnique({ where: { id: saleData.customerId }});
         if (customer) {
            const sumInstallments = installments && installments.length > 0 
               ? installments.reduce((acc: number, inst: any) => acc + inst.amount, 0)
               : saleData.totalAmount;

            await tx.customer.update({
               where: { id: customer.id },
               data: { credit_used: customer.credit_used + sumInstallments }
            });
         }
      }
      
      if (items && items.length > 0) {
         for (const item of items) {
            const product = await tx.product.findUnique({ where: { id: item.productId }});
            if (product) {
               await tx.product.update({
                  where: { id: product.id },
                  data: { stock: product.stock - item.quantity }
               });
            }
         }
      }

      return sale;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar venda' });
  }
});

// Routes for Stock Entries
app.get('/api/stock-entries', async (req, res) => {
  const entries = await prisma.stockEntry.findMany({
    include: { items: { include: { product: true } } },
    orderBy: { date: 'desc' }
  });
  res.json(entries);
});

app.post('/api/stock-entries', async (req, res) => {
  const { items, ...entryData } = req.body;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Cria a entrada de estoque
      const entry = await tx.stockEntry.create({
        data: {
          ...entryData,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost
            }))
          }
        },
        include: { items: true }
      });

      // Cria a despesa associada
      await tx.expense.create({
        data: {
          description: `Compra de estoque #${entry.id}`,
          amount: entry.totalAmount,
          type: 'STOCK_PURCHASE',
          category: 'Estoque',
          paymentMethod: entry.paymentMethod
        }
      });

      // Atualiza os produtos
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          // Mantém o preço de venda, ajusta as margens com base no novo custo
          const newCost = item.unitCost;
          const newMarginCash = ((product.price_cash - newCost) / newCost) * 100;
          const newMarginCredit = ((product.price_credit - newCost) / newCost) * 100;
          
          await tx.product.update({
            where: { id: product.id },
            data: { 
              stock: product.stock + item.quantity,
              cost: newCost,
              margin_cash: newMarginCash,
              margin_credit: newMarginCredit
            }
          });
        }
      }

      return entry;
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar entrada de estoque' });
  }
});

// Routes for Expenses
app.get('/api/expenses', async (req, res) => {
  const expenses = await prisma.expense.findMany({
    orderBy: { date: 'desc' }
  });
  res.json(expenses);
});

app.post('/api/expenses', async (req, res) => {
  const expense = await prisma.expense.create({ data: req.body });
  res.json(expense);
});

app.put('/api/expenses/:id', async (req, res) => {
  const { id } = req.params;
  const expense = await prisma.expense.update({
    where: { id: Number(id) },
    data: req.body
  });
  res.json(expense);
});

app.delete('/api/expenses/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.expense.delete({ where: { id: Number(id) } });
  res.json({ success: true });
});

// Routes for Installments
app.get('/api/installments', async (req, res) => {
  const { customerId, status } = req.query;
  const where: any = {};
  if (customerId) where.customerId = Number(customerId);
  if (status) where.status = status;
  
  const installments = await prisma.installment.findMany({ 
    where,
    include: { sale: true }
  });
  res.json(installments);
});

app.put('/api/installments/:id', async (req, res) => {
  const { id } = req.params;
  const installment = await prisma.installment.update({
    where: { id: Number(id) },
    data: req.body
  });
  res.json(installment);
});

// Routes for Payments
app.get('/api/payments', async (req, res) => {
  const payments = await prisma.payment.findMany();
  res.json(payments);
});

app.post('/api/payments', async (req, res) => {
  const payment = await prisma.payment.create({ data: req.body });
  res.json(payment);
});

// Routes for Employees
app.get('/api/employees', async (req, res) => {
  const employees = await prisma.employee.findMany();
  res.json(employees);
});

app.post('/api/employees', async (req, res) => {
  const employee = await prisma.employee.create({ data: req.body });
  res.json(employee);
});

// Routes for Suppliers
app.get('/api/suppliers', async (req, res) => {
  const suppliers = await prisma.supplier.findMany();
  res.json(suppliers);
});

app.post('/api/suppliers', async (req, res) => {
  const data = req.body;
  const supplier = await prisma.supplier.create({ data });
  res.json(supplier);
});

app.put('/api/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const supplier = await prisma.supplier.update({ where: { id: Number(id) }, data });
  res.json(supplier);
});

app.delete('/api/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  const supplier = await prisma.supplier.delete({ where: { id: Number(id) } });
  res.json(supplier);
});

// Auth Route
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;
  if (password === 'admin') {
    res.json({ token: 'fake-jwt-token-admin' });
  } else {
    res.status(401).json({ error: 'Senha incorreta' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
