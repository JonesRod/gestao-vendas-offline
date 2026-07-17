import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Package, ArrowLeft, Calendar, CreditCard, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function StoreOrders() {
  const location = useLocation();
  const highlightParam = new URLSearchParams(location.search).get('highlight');

  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(highlightParam === 'pending' ? 'pending' : 'all');

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user?.id) return;
      try {
        const response = await api.get(`/sales?customerId=${user.id}`);
        setOrders(response.data);
      } catch (err) {
        console.error('Failed to load orders', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span style={{ background: 'rgba(243, 156, 18, 0.2)', color: '#f39c12', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Clock size={14} /> Pendente</span>;
      case 'completed': return <span style={{ background: 'rgba(46, 204, 113, 0.2)', color: 'var(--success)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle size={14} /> Concluído</span>;
      case 'cancelled': return <span style={{ background: 'rgba(231, 76, 60, 0.2)', color: 'var(--danger)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><XCircle size={14} /> Cancelado</span>;
      default: return <span style={{ background: 'rgba(149, 165, 166, 0.2)', color: '#95a5a6', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>{status}</span>;
    }
  };

  const getPaymentName = (method: string) => {
    switch (method) {
      case 'credit': return 'Crediário';
      case 'credit_card': return 'Cartão de Crédito';
      case 'debit_card': return 'Cartão de Débito';
      case 'pix': return 'PIX';
      case 'money': return 'Dinheiro';
      default: return method;
    }
  };

  if (loading) {
    return <div className="store-container" style={{ textAlign: 'center', padding: '4rem' }}>Carregando pedidos...</div>;
  }

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'pending') return order.status === 'pending';
    if (filter === 'completed') return order.status === 'completed';
    if (filter === 'cancelled') return order.status === 'cancelled';
    return true;
  });

  return (
    <div className="store-container" style={{ paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link to="/loja" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={20} />
        </Link>
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Meus Pedidos</h2>
      </div>

      <div className="search-filters glass-panel" style={{ marginBottom: '2rem', padding: '1rem', borderRadius: '12px', display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
        <div className="filter-pills" style={{ margin: 0, display: 'flex', gap: '0.8rem', whiteSpace: 'nowrap' }}>
          <button 
            className={`pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
          <button 
            className={`pill ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pendentes
          </button>
          <button 
            className={`pill ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Confirmados
          </button>
          <button 
            className={`pill ${filter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setFilter('cancelled')}
          >
            Cancelados
          </button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', borderRadius: '12px' }}>
          <Package size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3 style={{ color: 'var(--text-main)' }}>Nenhum pedido encontrado</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Você ainda não realizou nenhuma compra.</p>
          <Link to="/loja" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem', padding: '0.8rem 2rem', textDecoration: 'none' }}>
            Ir para a Loja
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filteredOrders.map(order => {
            const isHighlighted = highlightParam === 'pending' && order.status === 'pending';
            return (
            <div key={order.id} className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', border: isHighlighted ? '2px solid var(--warning)' : 'none', background: isHighlighted ? 'rgba(245, 158, 11, 0.1)' : '' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Pedido #{order.id}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <Calendar size={14} />
                    {new Date(order.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div>
                  {getStatusBadge(order.status)}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Itens</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {order.items && order.items.map((item: any) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      <span>{item.quantity}x {item.product?.name || `Produto #${item.productId}`}</span>
                      {!order.paymentMethod?.includes('credit') && (
                        <span>R$ {(item.quantity * item.price_applied).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {order.installments && order.installments.length > 0 && (
                <div style={{ marginBottom: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CreditCard size={14} /> Parcelamento
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {order.installments.map((inst: any, idx: number) => (
                      <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-main)', fontSize: '0.95rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '6px' }}>
                        <div>
                          <div style={{ fontWeight: 500 }}>Parcela {idx + 1}/{order.installments.length}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Venc.: {new Date(inst.due_date).toLocaleDateString('pt-BR')}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontWeight: 'bold' }}>R$ {inst.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                          <span style={{ fontSize: '0.75rem', color: inst.status === 'paid' ? 'var(--success)' : 'var(--warning)', marginTop: '0.1rem' }}>
                            {inst.status === 'paid' ? 'Pago' : 'Pendente'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  <CreditCard size={16} />
                  Forma de Pagamento: <strong style={{ color: 'var(--text-main)' }}>{getPaymentName(order.paymentMethod)}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--text-secondary)', marginRight: '1rem', fontSize: '1rem' }}>Total:</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: 'bold' }}>
                    R$ {order.totalAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </span>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
