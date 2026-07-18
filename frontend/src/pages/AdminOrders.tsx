import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Package, CreditCard, Clock, CheckCircle, XCircle, FileText, Search, User, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Modal from '../components/Modal';

const formatPaymentMethod = (methodStr: string): string => {
  if (!methodStr) return '-';
  try {
    if (methodStr.startsWith('[')) {
      const parsed = JSON.parse(methodStr);
      return parsed.map((p: any) => formatPaymentMethod(p.method)).join(' + ');
    }
  } catch(e) {}
  
  if (methodStr.includes('fiado')) return 'Crediário';
  if (methodStr.includes('dinheiro')) return 'Dinheiro';
  if (methodStr.includes('pix')) return 'Pix';
  if (methodStr.includes('cartao_credito')) return 'Cartão de Crédito';
  if (methodStr.includes('cartao_debito')) return 'Cartão de Débito';
  
  return methodStr.replace(' | credit', '');
};

export default function AdminOrders() {
  const location = useLocation();
  const highlightParam = new URLSearchParams(location.search).get('highlight');

  const [sales, setSales] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<string>(highlightParam === 'pending' ? 'pending' : 'all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<number | null>(null);

  useEffect(() => {
    if (highlightParam === 'pending') {
      setFilter('pending');
    }
  }, [highlightParam]);

  useEffect(() => {
    loadSales();
    const interval = setInterval(() => {
      loadSales();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadSales = async () => {
    try {
      const response = await api.get('/sales');
      setSales(response.data);
    } catch (error) {
      console.error('Erro ao carregar pedidos', error);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      if (newStatus === 'cancelled') {
        setOrderToCancel(id);
        setConfirmModalOpen(true);
        return;
      }
      
      await api.put(`/sales/${id}/status`, { status: newStatus });
      loadSales(); // recarrega após atualizar
    } catch (error) {
      console.error('Erro ao atualizar status', error);
      alert('Erro ao atualizar status do pedido');
    }
  };

  const confirmCancel = async () => {
    if (!orderToCancel) return;
    try {
      await api.put(`/sales/${orderToCancel}/status`, { status: 'cancelled' });
      setConfirmModalOpen(false);
      setOrderToCancel(null);
      loadSales();
    } catch (error) {
      console.error('Erro ao cancelar pedido', error);
      alert('Erro ao cancelar o pedido');
    }
  };

  const filteredSales = sales.filter(s => {
    const matchesSearch = s.id.toString().includes(searchTerm) || (s.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || s.status === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string) => {
    if (status === 'completed') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--success)', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem' }}><CheckCircle size={14} /> Concluído</span>;
    if (status === 'cancelled') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--danger)', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem' }}><XCircle size={14} /> Cancelado</span>;
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--warning)', color: '#111', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem' }}><Clock size={14} /> Pendente</span>;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title"><FileText size={28} /> Gestão de Pedidos</h1>
          <p className="page-subtitle">Acompanhe e gerencie todos os pedidos realizados na loja</p>
        </div>
      </div>

      <div className="search-filters glass-panel" style={{ marginBottom: '2rem', padding: '1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="filter-pills" style={{ margin: 0, display: 'flex', gap: '0.8rem', whiteSpace: 'nowrap', overflowX: 'auto' }}>
          <button className={`pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todos</button>
          <button className={`pill ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pendentes</button>
          <button className={`pill ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>Confirmados</button>
          <button className={`pill ${filter === 'cancelled' ? 'active' : ''}`} onClick={() => setFilter('cancelled')}>Cancelados</button>
        </div>
        <div className="search-box" style={{ flex: '1 1 100%', minWidth: '0' }}>
          <Search size={20} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar pedido ou cliente..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-panel" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Pagamento</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map(sale => {
              const isHighlighted = highlightParam === 'pending' && sale.status === 'pending';
              return (
              <React.Fragment key={sale.id}>
                <tr className="table-row-hover" style={{ cursor: 'pointer', background: isHighlighted ? 'rgba(245, 158, 11, 0.1)' : (expandedId === sale.id ? 'var(--bg-panel)' : 'transparent'), borderLeft: isHighlighted ? '4px solid var(--warning)' : 'none' }} onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}>
                  <td style={{ fontWeight: 'bold' }}>#{sale.id}</td>
                  <td>{new Date(sale.date).toLocaleString('pt-BR')}</td>
                  <td>{sale.customer ? sale.customer.name : <span style={{ color: 'var(--text-muted)' }}>Sem Identificação</span>}</td>
                  <td style={{ fontWeight: 'bold' }}>R$ {sale.totalAmount.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                  <td>{formatPaymentMethod(sale.paymentMethod)}</td>
                  <td>{getStatusBadge(sale.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === sale.id ? null : sale.id); }}
                        className="btn-icon"
                        title="Ver Detalhes"
                      >
                        {expandedId === sale.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === sale.id && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0, border: 'none' }}>
                      <div style={{ background: 'var(--bg-main)', padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* Ações de Status */}
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>Alterar Status:</span>
                          <button onClick={() => handleStatusChange(sale.id, 'pending')} className="btn-secondary" style={{ padding: '0.4rem 1rem' }} disabled={sale.status === 'pending' || sale.status === 'cancelled'}>Marcar como Pendente</button>
                          <button onClick={() => handleStatusChange(sale.id, 'completed')} className="btn-secondary" style={{ padding: '0.4rem 1rem', borderColor: 'var(--success)', color: 'var(--success)' }} disabled={sale.status === 'completed' || sale.status === 'cancelled'}>Marcar como Concluído</button>
                          <button onClick={() => handleStatusChange(sale.id, 'cancelled')} className="btn-secondary" style={{ padding: '0.4rem 1rem', borderColor: 'var(--danger)', color: 'var(--danger)' }} disabled={sale.status === 'cancelled'}>Cancelar Pedido</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
                          {/* Detalhes do Cliente */}
                          {sale.customer && (
                            <div>
                              <h4 style={{ color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><User size={18} /> Detalhes do Cliente</h4>
                              <div style={{ background: 'var(--bg-panel)', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div><span style={{ color: 'var(--text-secondary)' }}>Nome:</span> {sale.customer.name}</div>
                                <div><span style={{ color: 'var(--text-secondary)' }}>CPF:</span> {sale.customer.cpf}</div>
                                <div><span style={{ color: 'var(--text-secondary)' }}>Telefone:</span> {sale.customer.phone}</div>
                              </div>
                            </div>
                          )}

                          {/* Itens do Pedido */}
                          <div>
                            <h4 style={{ color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Package size={18} /> Itens do Pedido</h4>
                            <div style={{ background: 'var(--bg-panel)', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {sale.items.map((item: any) => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span>{item.product.name}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                      {item.quantity}x {!sale.paymentMethod?.includes('credit') && `de R$ ${item.price_applied.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`}
                                    </span>
                                  </div>
                                  {!sale.paymentMethod?.includes('credit') && (
                                    <span style={{ fontWeight: 'bold' }}>R$ {(item.quantity * item.price_applied).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Parcelas do Pedido */}
                          {sale.installments && sale.installments.length > 0 && (
                            <div>
                              <h4 style={{ color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CreditCard size={18} /> Parcelamento (Crediário)</h4>
                              <div style={{ background: 'var(--bg-panel)', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {sale.installments.map((inst: any, idx: number) => (
                                  <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span>Parcela {idx + 1}/{sale.installments.length}</span>
                                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Vencimento: {new Date(inst.due_date).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                      <span style={{ fontWeight: 'bold' }}>R$ {inst.amount.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                                      <span style={{ fontSize: '0.75rem', color: inst.status === 'paid' ? 'var(--success)' : 'var(--warning)', background: 'var(--bg-main)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginTop: '0.2rem' }}>
                                        {inst.status === 'paid' ? 'Pago' : 'Pendente'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
              );
            })}
            {filteredSales.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Cancelar Pedido">
        <div style={{ padding: '1rem 0' }}>
          <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Tem certeza que deseja cancelar este pedido?<br/>O estoque e limite de crédito serão devolvidos.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setConfirmModalOpen(false)}>Não, Voltar</button>
            <button className="btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={confirmCancel}>Sim, Cancelar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
