import { TrendingUp, ShoppingBag, Users, AlertCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Sale, type Product, type Customer } from '../db/db';
import './Dashboard.css';

export default function Dashboard() {
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const productsResult = useLiveQuery(() => db.products.toArray()) || [];
  const customersResult = useLiveQuery(() => db.customers.toArray()) || [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const salesToday = sales.filter((s: Sale) => s.date >= today);
  const totalSalesToday = salesToday.reduce((sum: number, s: Sale) => sum + s.totalAmount, 0);

  const lowStockProducts = productsResult.filter((p: Product) => p.stock <= 10);

  // Top 5 vendas recentes
  const recentSales = sales.sort((a: Sale, b: Sale) => b.date.getTime() - a.date.getTime()).slice(0, 5);
  const stats = [
    { title: 'Vendas Hoje', value: `R$ ${totalSalesToday.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: TrendingUp, color: 'var(--success)' },
    { title: 'Pedidos Hoje', value: salesToday.length.toString(), icon: ShoppingBag, color: 'var(--primary)' },
    { title: 'Total Clientes', value: customersResult.length.toString(), icon: Users, color: 'var(--warning)' },
    { title: 'Estoque Baixo', value: `${lowStockProducts.length} itens`, icon: AlertCircle, color: 'var(--danger)' },
  ];

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
          <div className="chart-placeholder">
            {/* Gráfico será renderizado aqui posteriormente */}
            <p>Área do Gráfico</p>
          </div>
        </div>

        <div className="recent-card glass-panel">
          <div className="card-header">
            <h2>Vendas Recentes</h2>
          </div>
          <div className="recent-list">
            {recentSales.map((sale: Sale) => {
              const customerName = sale.customerId 
                ? customersResult.find((c: Customer) => c.id === sale.customerId)?.name || 'Cliente Vinculado' 
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
