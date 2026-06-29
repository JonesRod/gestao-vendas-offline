import { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, Users, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';
import type { Sale, Product, Customer } from '../db/db';
import './Dashboard.css';

export default function Dashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/sales'),
      api.get('/products'),
      api.get('/customers')
    ]).then(([salesRes, productsRes, customersRes]) => {
      // API returns ISO string for dates, convert to Date object
      const parsedSales = salesRes.data.map((s: any) => ({
        ...s,
        date: new Date(s.date)
      }));
      setSales(parsedSales);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const salesToday = sales.filter(s => s.date >= today);
  const totalSalesToday = salesToday.reduce((sum, s) => sum + s.totalAmount, 0);

  const lowStockProducts = products.filter(p => p.stock <= 10);

  const recentSales = [...sales].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
  
  // Preparar dados do gráfico da semana (últimos 7 dias)
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    
    const nextD = new Date(d);
    nextD.setDate(d.getDate() + 1);

    const daySales = sales.filter(s => s.date >= d && s.date < nextD);
    const dayTotal = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
    
    chartData.push({
      name: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
      total: dayTotal
    });
  }

  const stats = [
    { title: 'Vendas Hoje', value: `R$ ${totalSalesToday.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: TrendingUp, color: 'var(--success)' },
    { title: 'Pedidos Hoje', value: salesToday.length.toString(), icon: ShoppingBag, color: 'var(--primary)' },
    { title: 'Total Clientes', value: customers.length.toString(), icon: Users, color: 'var(--warning)' },
    { title: 'Estoque Baixo', value: `${lowStockProducts.length} itens`, icon: AlertCircle, color: 'var(--danger)' },
  ];

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-main)' }}>Carregando dashboard...</div>;

  return (
    <div className="dashboard-container">
      <h1 className="page-title">Dashboard</h1>
      
      <div className="stats-grid">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="stat-card glass-panel">
              <div className="stat-icon-wrapper" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                <Icon size={24} />
              </div>
              <div className="stat-info">
                <p className="stat-title">{stat.title}</p>
                <h3 className="stat-value">{stat.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-content-grid">
        <div className="chart-card glass-panel">
          <div className="card-header">
            <h2>Vendas da Semana</h2>
          </div>
          <div style={{ height: '300px', width: '100%', padding: '1rem 0', marginTop: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `R$ ${value}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-main)' }}
                  itemStyle={{ color: 'var(--primary)', fontWeight: 'bold' }}
                  formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 'Total']}
                />
                <Area type="monotone" dataKey="total" stroke="var(--primary)" fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="recent-card glass-panel">
          <div className="card-header">
            <h2>Vendas Recentes</h2>
          </div>
          <div className="recent-list">
            {recentSales.map(sale => {
              const customerName = sale.customerId 
                ? customers.find(c => c.id === sale.customerId)?.name || 'Cliente Vinculado' 
                : 'Cliente Avulso (Não identificado)';
              
              return (
              <div key={sale.id} className="recent-item">
                <div className="recent-item-info">
                  <h4>Venda #{sale.id}</h4>
                  <p>{customerName}</p>
                </div>
                <div className="recent-item-value">
                  <span className="value">R$ {sale.totalAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  <span className={`status ${sale.status === 'paid' ? 'success' : 'warning'}`}>
                    {sale.status === 'paid' ? 'Pago' : 'A Prazo'}
                  </span>
                </div>
              </div>
            )})}
            {recentSales.length === 0 && (
              <p style={{textAlign: 'center', color: 'var(--text-muted)'}}>Nenhuma venda recente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
