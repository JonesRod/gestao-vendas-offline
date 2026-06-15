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
  const sales = await prisma.sale.findMany({ include: { items: true } });
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
          },
          installments: {
            create: installments || []
          }
        }
      });

      if (saleData.customerId && saleData.paymentMethod === 'credit') {
         const customer = await tx.customer.findUnique({ where: { id: saleData.customerId }});
         if (customer) {
            await tx.customer.update({
               where: { id: customer.id },
               data: { credit_used: customer.credit_used + saleData.totalAmount }
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

// Routes for Employees
app.get('/api/employees', async (req, res) => {
  const employees = await prisma.employee.findMany();
  res.json(employees);
});

app.post('/api/employees', async (req, res) => {
  const employee = await prisma.employee.create({ data: req.body });
  res.json(employee);
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
