import Dexie, { type EntityTable } from 'dexie';

// 1. Definição das Interfaces (Tabelas)
export interface Address {
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  observation: string;
  lat?: number;
  lng?: number;
}

export interface Customer {
  id?: number;
  name: string;
  cpf?: string;
  email?: string;
  birth_date?: string;
  phone: string;
  credit_limit: number;
  credit_used: number;
  is_blocked: boolean;
  is_loyal?: boolean;
  due_date: number;
  status?: 'ativo' | 'espera' | 'serasa';
  address?: Address;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  observation?: string;
  lat?: number;
  lng?: number;
  created_at: Date;
}

export interface KitItem {
  productId: number;
  quantity: number;
}

export interface Product {
  [x: string]: any;
  id?: number;
  name: string;
  description?: string;
  cost?: number;
  margin_cash?: number;
  margin_credit?: number;
  price_cash: number;
  price_credit: number;
  stock: number;
  is_active?: boolean;
  images?: string[];
  type: 'product' | 'kit';
  kit_items?: KitItem[];
  allow_credit?: boolean;
  max_installments?: number;
  punctuality_discount_active?: boolean;
  punctuality_discount_percent?: number;
  punctuality_discount_value?: number;
  loyalty_discount_active?: boolean;
  loyalty_discount_percent?: number;
  loyalty_discount_value?: number;
  created_at?: Date;
}

export interface Sale {
  id?: number;
  customerId?: number; // Opcional (se for venda avulsa)
  totalAmount: number;
  paymentMethod: 'cash' | 'credit';
  status: 'paid' | 'pending';
  date: Date;
  due_date?: Date;
  invoice_number?: string;
}

export interface Installment {
  id?: number;
  saleId: number;
  customerId: number;
  amount: number;
  due_date: Date;
  status: 'paid' | 'pending';
  number: number;
  total: number;
  productName: string; // Para o cliente e lojista saberem do que é essa parcela (ou 'Vários' se agrupar)
  sale?: any;
}

export interface Payment {
  id?: number;
  customerId: number;
  amount: number;
  method: 'cash' | 'pix' | 'card';
  date: Date;
}

export interface SaleItem {
  id?: number;
  saleId: number;
  productId: number;
  quantity: number;
  price_applied: number;
}

export interface Employee {
  id?: number;
  name: string;
  cpf?: string;
  email?: string;
  birth_date?: string;
  role: string;
  phone: string;
  is_active: boolean;
  address?: Address;
  created_at: Date;
}

export interface Settings {
  id?: number;
  tradeName: string;
  companyName: string;
  cnpj: string;
  ownerBirthDate: string;
  email: string;
  phone: string;
  address?: Address;
  loyalty_active: boolean;
  loyalty_days: number;
  penalty_active: boolean;
  penalty_percent: number;
  interest_percent: number;
  whatsapp_token?: string;
  whatsapp_instance?: string;
  email_token?: string;
  email_sender?: string;
  punctuality_discount_active?: boolean;
  punctuality_discount_percent?: number;
  online_payment_active?: boolean;
  payment_gateway?: string;
  payment_api_key?: string;
  payment_webhook_secret?: string;
  updated_at?: Date;
}

// 2. Configuração do Banco Dexie
const db = new Dexie('GestaoOfflineDB') as Dexie & {
  customers: EntityTable<Customer, 'id'>,
  products: EntityTable<Product, 'id'>,
  sales: EntityTable<Sale, 'id'>,
  saleItems: EntityTable<SaleItem, 'id'>,
  installments: EntityTable<Installment, 'id'>,
  employees: EntityTable<Employee, 'id'>,
  settings: EntityTable<Settings, 'id'>,
  payments: EntityTable<Payment, 'id'>
};

// Configuração do Schema (quais campos são indexados para busca)
db.version(7).stores({
  customers: '++id, name, cpf, phone, is_blocked',
  products: '++id, name, type, is_active',
  sales: '++id, customerId, status, date',
  saleItems: '++id, saleId, productId',
  installments: '++id, saleId, customerId, status, due_date',
  employees: '++id, name, cpf, role, is_active',
  settings: '++id',
  payments: '++id, customerId, date'
});

// Seed database removido a pedido do usuário

export { db };
