import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

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
app.get('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  const customer = await prisma.customer.findUnique({ where: { id: Number(id) } });
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

// Routes for Categories
app.get('/api/categories', async (req, res) => {
  const categories = await prisma.category.findMany();
  res.json(categories);
});

app.post('/api/categories', async (req, res) => {
  const category = await prisma.category.create({ data: req.body });
  res.json(category);
});

app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const category = await prisma.category.update({
    where: { id: Number(id) },
    data: req.body
  });
  res.json(category);
});

app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.category.delete({ where: { id: Number(id) } });
  res.json({ success: true });
});

// Routes for Products
app.get('/api/products', async (req, res) => {
  const products = await prisma.product.findMany({ include: { kitItemsParent: true, category: true } });
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
  const { customerId } = req.query;
  const whereClause = customerId ? { customerId: Number(customerId) } : {};
  const sales = await prisma.sale.findMany({ 
    where: whereClause,
    include: { items: { include: { product: true } }, installments: true, customer: true },
    orderBy: { date: 'desc' }
  });
  res.json(sales);
});

app.put('/api/sales/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { items: true, installments: true }
    });

    if (!sale) return res.status(404).json({ error: 'Pedido não encontrado' });

    // Cancelar pedido
    if (status === 'cancelled' && sale.status !== 'cancelled') {
      await prisma.$transaction(async (tx) => {
        // Voltar estoque
        for (const item of sale.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId }});
          if (product) {
            await tx.product.update({
              where: { id: product.id },
              data: { stock: product.stock + item.quantity }
            });
          }
        }

        // Devolver limite de crédito
        if (sale.customerId && sale.paymentMethod.includes('credit')) {
          const customer = await tx.customer.findUnique({ where: { id: sale.customerId }});
          if (customer) {
            const sumInstallments = sale.installments.reduce((acc, inst) => acc + inst.amount, 0);
            await tx.customer.update({
              where: { id: customer.id },
              data: { credit_used: Math.max(0, customer.credit_used - sumInstallments) }
            });
          }
        }

        // Cancelar parcelas pendentes
        await tx.installment.updateMany({
          where: { saleId: sale.id, status: 'pending' },
          data: { status: 'cancelled' }
        });

        // Atualizar status da venda
        await tx.sale.update({
          where: { id: sale.id },
          data: { status: 'cancelled' }
        });
      });
      return res.json({ success: true, message: 'Pedido cancelado' });
    }

    // Apenas atualizar o status para outros (ex: completed)
    const updatedSale = await prisma.sale.update({
      where: { id: Number(id) },
      data: { status }
    });
    res.json(updatedSale);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar status do pedido' });
  }
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

      if (saleData.customerId && saleData.paymentMethod.includes('credit')) {
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

app.post('/api/installments', async (req, res) => {
  const installment = await prisma.installment.create({ data: req.body });
  res.json(installment);
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
  const data = req.body;
  // Extrair o address para campos flat, se existir
  const flatData = { ...data };
  if (data.address) {
    flatData.cep = data.address.cep;
    flatData.street = data.address.street;
    flatData.number = data.address.number;
    flatData.neighborhood = data.address.neighborhood;
    flatData.city = data.address.city;
    flatData.state = data.address.state;
    flatData.observation = data.address.observation;
    delete flatData.address;
  }
  const employee = await prisma.employee.create({ data: flatData });
  res.json(employee);
});

app.put('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  
  const flatData = { ...data };
  if (data.address) {
    flatData.cep = data.address.cep;
    flatData.street = data.address.street;
    flatData.number = data.address.number;
    flatData.neighborhood = data.address.neighborhood;
    flatData.city = data.address.city;
    flatData.state = data.address.state;
    flatData.observation = data.address.observation;
    delete flatData.address;
  }
  
  try {
    const employee = await prisma.employee.update({
      where: { id: Number(id) },
      data: flatData,
    });
    res.json(employee);
  } catch (error) {
    console.log(`[EMPLOYEE UPDATE] Record not found, creating with id ${id}`);
    const employee = await prisma.employee.create({
      data: { ...flatData, id: Number(id) },
    });
    res.json(employee);
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const employee = await prisma.employee.delete({ where: { id: Number(id) } });
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

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_for_jwt_offline';

// Função helper para buscar usuário por CPF com ou sem máscara
const findUserByCpf = async (model: any, cpfString: string) => {
  if (!cpfString) return null;
  const cleanCpf = cpfString.replace(/\D/g, '');
  if (cleanCpf.length !== 11) return null;
  
  const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  
  return await model.findFirst({
    where: {
      OR: [
        { cpf: { contains: cleanCpf } },
        { cpf: { contains: formattedCpf } }
      ]
    }
  });
};

// Rota auxiliar para verificar perfis de um CPF
app.post('/api/auth/check-cpf', async (req, res) => {
  const { cpf } = req.body;
  const cleanCpf = cpf?.replace(/\D/g, '');
  
  const roles = [];

  const employee = await findUserByCpf(prisma.employee, cpf);
  if (employee) {
    roles.push(employee.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE');
  } else if (cleanCpf === '02346827100') {
    // Master admin de fallback se não houver funcionário
    roles.push('ADMIN');
  }

  const customer = await findUserByCpf(prisma.customer, cpf);
  if (customer) {
    roles.push('CUSTOMER');
  }

  res.json({ roles });
});

// Auth Route
app.post('/api/auth/login', async (req, res) => {
  const { cpf, password, role } = req.body;
  const cleanCpf = cpf?.replace(/\D/g, '');
  const cleanPassword = password?.trim();

  console.log(`[LOGIN ATTEMPT] CPF: ${cleanCpf}, Role: ${role}`);

  const validRoles = [];
  let userDetails = null;

  // Master Admin (fallback para ADMIN)
  if (cleanCpf === '02346827100' && cleanPassword === '123456') {
    validRoles.push('ADMIN');
    if (role === 'ADMIN') {
      userDetails = { id: 0, name: 'Master Admin', cpf: '023.468.271-00' };
    }
  }

  // Verifica Employee
  const employee = await findUserByCpf(prisma.employee, cpf);
  if (employee) {
    let validEmployeePass = false;
    if (!employee.password) {
      validEmployeePass = cleanPassword === cleanCpf.substring(0, 4);
    } else {
      validEmployeePass = await bcrypt.compare(cleanPassword, employee.password);
    }
    if (validEmployeePass) {
      if (!validRoles.includes('ADMIN') && employee.role === 'ADMIN') validRoles.push('ADMIN');
      if (employee.role === 'EMPLOYEE') validRoles.push('EMPLOYEE');
      if (role && (role === 'ADMIN' || role === 'EMPLOYEE')) userDetails = employee;
    }
  }

  // Verifica Customer
  const customer = await findUserByCpf(prisma.customer, cpf);
  if (customer) {
    let validCustomerPass = false;
    if (cleanCpf === '02346827100' && cleanPassword === '123456') {
      validCustomerPass = true;
    } else if (!customer.password) {
      validCustomerPass = cleanPassword === cleanCpf.substring(0, 4);
    } else {
      validCustomerPass = await bcrypt.compare(cleanPassword, customer.password);
    }
    if (validCustomerPass) {
      validRoles.push('CUSTOMER');
      if (role === 'CUSTOMER') userDetails = customer;
    }
  }

  if (validRoles.length === 0) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  if (!role) {
    if (validRoles.length > 1) {
      return res.json({ requireRoleSelection: true, availableRoles: validRoles });
    }
    const singleRole = validRoles[0];
    let userToLog = singleRole === 'CUSTOMER' ? customer : employee;
    if (!userToLog && singleRole === 'ADMIN' && cleanCpf === '02346827100') {
      userToLog = { id: 0, name: 'Master Admin', cpf: '023.468.271-00' } as any;
    }
    if (!userToLog) return res.status(500).json({ error: 'Erro interno ao resolver usuário' });

    const token = jwt.sign({ id: userToLog.id, role: singleRole }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...safeUserToLog } = userToLog;
    return res.json({ token, role: singleRole, user: safeUserToLog });
  }

  if (!validRoles.includes(role)) {
    return res.status(401).json({ error: 'Perfil não autorizado para estas credenciais' });
  }

  if (!userDetails) {
    return res.status(500).json({ error: 'Erro interno ao resolver detalhes do perfil' });
  }

  const token = jwt.sign({ id: userDetails.id, role }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...safeUserDetails } = userDetails;
  return res.json({ token, role, user: safeUserDetails });
});

// Registrar Cliente (Loja)
app.post('/api/auth/register', async (req, res) => {
  const { name, cpf, email, phone, password } = req.body;
  const cleanCpf = cpf?.replace(/\D/g, '');

  if (!name || !cleanCpf || !phone || !password) {
    return res.status(400).json({ error: 'Preencha os campos obrigatórios: Nome, CPF, Celular e Senha.' });
  }

  try {
    const existing = await findUserByCpf(prisma.customer, cleanCpf);
    if (existing) {
      return res.status(400).json({ error: 'Já existe um cliente cadastrado com este CPF.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newCustomer = await prisma.customer.create({
      data: {
        name,
        cpf: cleanCpf,
        email,
        phone,
        password: hashedPassword,
        credit_limit: 0,
        credit_used: 0,
        due_date: 10,
        is_blocked: false,
        is_loyal: false,
      }
    });

    const { password: _, ...safeCustomer } = newCustomer;
    res.json({ success: true, customer: safeCustomer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
  }
});

// Recuperação de senha simulada
app.post('/api/auth/forgot-password', async (req, res) => {
  const { cpf, method } = req.body;
  // Apenas simulação por enquanto
  console.log(`[SIMULAÇÃO] Recuperação de senha solicitada para ${cpf} via ${method}`);
  console.log(`Link para resetar (apenas exemplo): http://localhost:5173/reset-password?token=12345&cpf=${cpf}`);
  res.json({ success: true, message: `Instruções enviadas via ${method}` });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { cpf, token, newPassword } = req.body;
  const cleanCpf = cpf.replace(/\D/g, '');
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  const employee = await prisma.employee.findFirst({ where: { cpf: { contains: cleanCpf } } });
  if (employee) {
    await prisma.employee.update({ where: { id: employee.id }, data: { password: hashedPassword } });
  }
  
  const customer = await prisma.customer.findFirst({ where: { cpf: { contains: cleanCpf } } });
  if (customer) {
    await prisma.customer.update({ where: { id: customer.id }, data: { password: hashedPassword } });
  }

  res.json({ success: true });
});

// Settings Routes
app.get('/api/settings', async (req, res) => {
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    // Retorna defaults se nao existir
    return res.json({});
  }
  res.json(settings);
});

app.put('/api/settings', async (req, res) => {
  const data = req.body;
  
  // Como só temos 1 registro de settings globalmente
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data });
  } else {
    settings = await prisma.settings.update({
      where: { id: settings.id },
      data
    });
  }
  res.json(settings);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
