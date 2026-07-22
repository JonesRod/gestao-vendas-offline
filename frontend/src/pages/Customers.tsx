import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Plus, UserX, UserCheck, Edit, DollarSign, Trash2, History, Share2 } from 'lucide-react';
import { api } from '../services/api';
import type { Customer } from '../db/db';
import Modal from '../components/Modal';
import { maskCPF, maskPhone, maskCEP, maskDate, fetchAddressByCep, maskCurrency, parseCurrency } from '../utils/masks';
import './Customers.css';

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'credit' | 'blocked'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const initialFormState: Partial<Customer> = {
    name: '', phone: '', cpf: '', email: '', birth_date: '', credit_limit: 0, is_blocked: false, is_loyal: false, status: 'ativo', due_date: 5,
    address: { cep: '', street: '', number: '', neighborhood: '', city: '', state: '', observation: '' }
  };
  const [formData, setFormData] = useState<Partial<Customer>>(initialFormState);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const location = useLocation();

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryCustomer, setSelectedHistoryCustomer] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);

  const sharePaymentReceipt = async (pay: any, custName: string) => {
    // Pegar o crédito atual do cliente selecionado no histórico
    const restante = selectedHistoryCustomer ? selectedHistoryCustomer.credit_used : 0;
    
    const text = `🧾 *RECIBO DE PAGAMENTO* 🧾
-----------------------------------
*Cliente:* ${custName}
*Data:* ${new Date(pay.date).toLocaleDateString('pt-BR')}
*Valor Baixado:* R$ ${pay.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
-----------------------------------
*Forma de Pagamento:* ${pay.method === 'cash' ? 'Dinheiro' : pay.method === 'pix' ? 'PIX' : 'Cartão'}
*Restante a Pagar (Dívida Atual):* R$ ${restante.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
-----------------------------------
Obrigado pela preferência!`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Recibo', text });
      } catch (e) {
        if ((e as any).name !== 'AbortError') {
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const shareSaleReceipt = async (sale: any) => {
    const custName = selectedHistoryCustomer?.name || 'Cliente';
    
    let productsText = '';
    if (sale.items && sale.items.length > 0) {
       productsText = sale.items.map((i: any) => `${i.quantity}x ${i.product?.name || 'Produto'}`).join('\n');
    } else {
       productsText = 'Itens não detalhados';
    }

    const text = `🧾 *RECIBO DE COMPRA* 🧾
-----------------------------------
*Cliente:* ${custName}
*Cód. da Compra:* #${sale.id}
*Data:* ${new Date(sale.date).toLocaleDateString('pt-BR')}
*Valor Total:* R$ ${sale.totalAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
-----------------------------------
*Produto(s):*
${productsText}
-----------------------------------
*Forma de Pagamento:* ${sale.paymentMethod === 'cash' ? 'Vista/Din/Pix' : 'Fiado/Cartão'}
*Status:* ${sale.status === 'paid' ? 'Pago' : 'Pendente'}
-----------------------------------
Obrigado pela preferência!`;

    if (navigator.share) {
      try { await navigator.share({ title: 'Recibo de Compra', text }); } 
      catch (e) { if ((e as any).name !== 'AbortError') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data } = await api.get('/customers');
      // Mapear propriedades planas do backend para o formato de subobjeto address do form
      const formatted = data.map((c: any) => ({
        ...c,
        address: {
          cep: c.cep || '',
          street: c.street || '',
          number: c.number || '',
          neighborhood: c.neighborhood || '',
          city: c.city || '',
          state: c.state || '',
          observation: c.observation || ''
        }
      }));
      setCustomers(formatted);
      
      // Auto-open modal se vier do redirecionamento
      if (location.state?.editCustomerId) {
        const customerToEdit = formatted.find((c: Customer) => c.id === location.state.editCustomerId);
        if (customerToEdit) {
          setFormData(customerToEdit);
          setIsModalOpen(true);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar clientes", error);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [location.state]);

  const filteredCustomers = customers.filter((c: Customer) => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm);
    if (!matchesSearch) return false;
    if (filter === 'credit') return c.credit_limit > 0 && !c.is_blocked;
    if (filter === 'blocked') return c.is_blocked;
    return true;
  });

  const openEditModal = (customer: Customer) => {
    setFormData(customer);
    setIsModalOpen(true);
  };

  const openHistoryModal = async (customer: Customer) => {
    setSelectedHistoryCustomer(customer);
    setIsHistoryModalOpen(true);
    try {
      const [salesRes, paymentsRes] = await Promise.all([
        api.get('/sales'),
        api.get('/payments')
      ]);
      const s = salesRes.data.filter((sale: any) => sale.customerId === customer.id).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const p = paymentsRes.data.filter((pay: any) => pay.customerId === customer.id).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCustomerSales(s);
      setCustomerPayments(p);
    } catch (e) {
      console.error("Erro ao carregar histórico", e);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        await api.delete(`/customers/${id}`);
        fetchCustomers();
      } catch (error) {
        console.error("Erro ao excluir", error);
      }
    }
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCep = maskCEP(e.target.value);
    setFormData(prev => ({ ...prev, address: { ...prev.address!, cep: newCep } }));
    
    if (newCep.length === 9) {
      const addressData = await fetchAddressByCep(newCep);
      if (addressData) {
        setFormData(prev => ({
          ...prev,
          address: {
            ...prev.address!,
            street: addressData.street || prev.address!.street,
            neighborhood: addressData.neighborhood || prev.address!.neighborhood,
            city: addressData.city || prev.address!.city,
            state: addressData.state || prev.address!.state,
          }
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const customerData = {
      name: formData.name!,
      cpf: formData.cpf,
      email: formData.email,
      birth_date: formData.birth_date,
      phone: formData.phone!,
      credit_limit: Number(formData.credit_limit) || 0,
      is_blocked: formData.is_blocked || false,
      is_loyal: formData.is_loyal || false,
      status: formData.status || 'ativo',
      due_date: Number(formData.due_date) || 0,
      cep: formData.address?.cep,
      street: formData.address?.street,
      number: formData.address?.number,
      neighborhood: formData.address?.neighborhood,
      city: formData.address?.city,
      state: formData.address?.state,
      observation: formData.address?.observation,
    };

    try {
      if (formData.id) {
        await api.put(`/customers/${formData.id}`, customerData);
      } else {
        await api.post('/customers', { ...customerData, credit_used: 0 });
      }
      setIsModalOpen(false);
      setFormData(initialFormState);
      fetchCustomers();
    } catch (error) {
      console.error("Erro ao salvar cliente", error);
    }
  };

  return (
    <div className="customers-container">
      <div className="page-header">
        <h1 className="page-title">Gerenciamento de Clientes</h1>
        <button className="btn-primary add-btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} />
          Novo Cliente
        </button>
      </div>

      <div className="search-filters glass-panel">
        <div className="search-box">
          <Search size={20} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou telefone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-pills">
          <button className={`pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todos</button>
          <button className={`pill ${filter === 'credit' ? 'active' : ''}`} onClick={() => setFilter('credit')}>Com Crédito</button>
          <button className={`pill blocked ${filter === 'blocked' ? 'active' : ''}`} onClick={() => setFilter('blocked')}>Bloqueados</button>
        </div>
      </div>

      <div className="customers-grid">
        {filteredCustomers.map((customer: Customer) => {
          const availableCredit = customer.credit_limit - customer.credit_used;
          const usagePercent = customer.credit_limit > 0 ? (customer.credit_used / customer.credit_limit) * 100 : 0;
          
          return (
            <div key={customer.id} className={`customer-card glass-panel ${customer.is_blocked ? 'is-blocked' : ''}`}>
              <div className="card-top">
                <div className="customer-info">
                  <h3>{customer.name}</h3>
                  <p>{customer.phone}</p>
                </div>
                <div className="status-icon" style={{ display: 'flex', gap: '0.5rem' }}>
                  {customer.is_loyal && (
                    <div className="badge success" style={{textTransform: 'uppercase', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.4)'}}>★ Fiel</div>
                  )}
                  {customer.status === 'sem_crediario' ? (
                    <div className="badge" style={{textTransform: 'uppercase', background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.4)'}}><UserX size={16} /> Sem Crediário</div>
                  ) : customer.status === 'serasa' ? (
                    <div className="badge danger" style={{textTransform: 'uppercase'}}><UserX size={16} /> Serasa</div>
                  ) : customer.status === 'espera' ? (
                    <div className="badge warning" style={{textTransform: 'uppercase'}}><UserX size={16} /> Espera</div>
                  ) : (
                    <div className="badge success" style={{textTransform: 'uppercase'}}><UserCheck size={16} /> Ativo</div>
                  )}
                </div>
              </div>

              {customer.status !== 'sem_crediario' ? (
                <div className="credit-section">
                  <div className="credit-header">
                    <span className="credit-label"><DollarSign size={16} /> Limite de Crédito (Fiado)</span>
                    <span className="credit-amount">R$ {customer.credit_limit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  
                  {customer.credit_limit > 0 ? (
                    <>
                      <div className="progress-bar-container">
                        <div 
                          className={`progress-bar ${usagePercent > 85 ? 'danger' : usagePercent > 60 ? 'warning' : 'success'}`}
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        ></div>
                      </div>
                      
                      <div className="credit-footer">
                        <span className="used">Usado: R$ {customer.credit_used.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        <span className="available">Livre: R$ {availableCredit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                    </>
                  ) : (
                    <p className="no-credit">Cliente compra apenas à vista / Dinheiro</p>
                  )}
                </div>
              ) : (
                <div className="credit-section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Sem crediário aprovado</p>
                </div>
              )}

              <div className="card-actions">
                <div style={{display: 'flex', gap: '1rem'}}>
                  <button className="btn-icon" title="Histórico" onClick={() => openHistoryModal(customer)}>
                    <History size={18} /> Histórico
                  </button>
                  <button className="btn-icon" title="Editar Cliente" onClick={() => openEditModal(customer)}>
                    <Edit size={18} /> Editar
                  </button>
                  <button className="btn-icon danger" title="Excluir" onClick={() => customer.id && handleDelete(customer.id)}>
                    <Trash2 size={18} /> Excluir
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? 'Editar Cliente' : 'Novo Cliente'}>
        <form onSubmit={handleSubmit}>
          <h3 style={{fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)'}}>Dados Pessoais</h3>
          
          <div className="form-group">
            <label>Nome Completo</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>CPF</label>
              <input type="text" placeholder="000.000.000-00" value={formData.cpf} onChange={e => setFormData({...formData, cpf: maskCPF(e.target.value)})} />
            </div>
            <div className="form-group">
              <label>Data de Nascimento</label>
              <input type="text" placeholder="DD/MM/AAAA" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: maskDate(e.target.value)})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Telefone / WhatsApp</label>
              <input type="text" required placeholder="(00) 00000-0000" value={formData.phone} onChange={e => setFormData({...formData, phone: maskPhone(e.target.value)})} />
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input type="email" placeholder="cliente@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
          </div>

          <h3 style={{fontSize: '1rem', margin: '1.5rem 0 1rem', color: 'var(--primary)'}}>Endereço</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>CEP</label>
              <input type="text" placeholder="00000-000" value={formData.address?.cep} onChange={handleCepChange} />
            </div>
            <div className="form-group">
              <label>UF</label>
              <input type="text" maxLength={2} placeholder="SP" value={formData.address?.state} onChange={e => setFormData({...formData, address: {...formData.address!, state: e.target.value}})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex: 2}}>
              <label>Rua / Avenida</label>
              <input type="text" value={formData.address?.street} onChange={e => setFormData({...formData, address: {...formData.address!, street: e.target.value}})} />
            </div>
            <div className="form-group">
              <label>Número</label>
              <input type="text" value={formData.address?.number} onChange={e => setFormData({...formData, address: {...formData.address!, number: e.target.value}})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Bairro</label>
              <input type="text" value={formData.address?.neighborhood} onChange={e => setFormData({...formData, address: {...formData.address!, neighborhood: e.target.value}})} />
            </div>
            <div className="form-group">
              <label>Cidade</label>
              <input type="text" value={formData.address?.city} onChange={e => setFormData({...formData, address: {...formData.address!, city: e.target.value}})} />
            </div>
          </div>

          <div className="form-group">
            <label>Observação de Endereço (Opcional)</label>
            <input type="text" placeholder="Ex: Ao lado da padaria" value={formData.address?.observation} onChange={e => setFormData({...formData, address: {...formData.address!, observation: e.target.value}})} />
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '0.5rem' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Status de Fidelidade
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {formData.is_loyal ? (
                <div className="badge success" style={{ textTransform: 'uppercase', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '6px 12px', fontSize: '0.85rem' }}>
                  ★ Cliente Fiel
                </div>
              ) : (
                <div className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '6px 12px', fontSize: '0.85rem' }}>
                  Cliente Normal
                </div>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                (Definido automaticamente pelas configurações)
              </span>
            </div>
          </div>

          <h3 style={{fontSize: '1rem', margin: '1.5rem 0 1rem', color: 'var(--primary)'}}>Limites e Crédito</h3>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <label className="toggle-switch">
                <input type="checkbox" checked={!formData.is_blocked} onChange={(e) => setFormData({...formData, is_blocked: !e.target.checked, status: e.target.checked ? 'ativo' : 'espera'})} />
                <span className="slider"></span>
              </label>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Permitir Vendas no Crediário</span>
            </div>
            
            <label style={{marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.9rem'}}>Classificação de Status (Detalhe)</label>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.9rem', opacity: !formData.is_blocked ? 0.5 : 1 }}>
                <input type="radio" name="customer_status" checked={formData.is_blocked && formData.status === 'sem_crediario'} onChange={() => setFormData({...formData, status: 'sem_crediario', is_blocked: true})} />
                Sem Crediário
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.9rem', opacity: formData.is_blocked ? 0.5 : 1 }}>
                <input type="radio" name="customer_status" checked={!formData.is_blocked} onChange={() => setFormData({...formData, status: 'ativo', is_blocked: false})} />
                Crediário Ativo
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.9rem', opacity: !formData.is_blocked ? 0.5 : 1 }}>
                <input type="radio" name="customer_status" checked={formData.is_blocked && formData.status === 'espera'} onChange={() => setFormData({...formData, status: 'espera', is_blocked: true})} />
                Em Espera (Bloq.)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.9rem', opacity: !formData.is_blocked ? 0.5 : 1 }}>
                <input type="radio" name="customer_status" checked={formData.is_blocked && formData.status === 'serasa'} onChange={() => setFormData({...formData, status: 'serasa', is_blocked: true})} />
                Serasa (Bloq.)
              </label>
            </div>
            {formData.is_blocked && formData.status === 'sem_crediario' && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <i className="fa-solid fa-info-circle"></i> O cliente ainda não tem crediário aprovado, mas poderá solicitar futuramente.
              </p>
            )}
          </div>
          
          {formData.status !== 'sem_crediario' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Limite de Cadastro (R$)</label>
                  <input type="text" value={maskCurrency(formData.credit_limit || 0)} onChange={e => setFormData({...formData, credit_limit: parseCurrency(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label>Vencimento Padrão (Dia)</label>
                  <input type="number" min="0" max="31" value={formData.due_date} onChange={e => setFormData({...formData, due_date: Number(e.target.value)})} />
                </div>
              </div>
              
              {formData.id && (
                <div className="form-group" style={{background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)'}}>
                  <label style={{color: 'var(--danger)'}}>Correção Manual: Crédito Utilizado (Dívida)</label>
                  <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem'}}>Altere apenas se houver erro no saldo do cliente.</p>
                  <input type="text" value={maskCurrency(formData.credit_used || 0)} onChange={e => setFormData({...formData, credit_used: parseCurrency(e.target.value)})} />
                </div>
              )}
            </>
          )}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar Cliente</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title={`Histórico: ${selectedHistoryCustomer?.name}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Compras</h3>
            {customerSales.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Nenhuma compra registrada.</p>
            ) : (
              <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.8rem', color: 'var(--text-muted)' }}>Data</th>
                    <th style={{ padding: '0.8rem', color: 'var(--text-muted)' }}>Método</th>
                    <th style={{ padding: '0.8rem', color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ padding: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {customerSales.map(sale => (
                    <tr key={sale.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.8rem' }}>{new Date(sale.date).toLocaleString()}</td>
                      <td style={{ padding: '0.8rem', textTransform: 'capitalize' }}>{sale.paymentMethod === 'cash' ? 'Vista/Din/Pix' : 'Fiado/Cartão'}</td>
                      <td style={{ padding: '0.8rem' }}>
                        {sale.status === 'paid' ? (
                          <span style={{ color: 'var(--success)' }}>Pago</span>
                        ) : (
                          <span style={{ color: 'var(--warning)' }}>Pendente</span>
                        )}
                      </td>
                      <td style={{ padding: '0.8rem', textAlign: 'right', fontWeight: 'bold', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                        R$ {sale.totalAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        <button className="btn-secondary" title="Compartilhar Recibo" onClick={() => shareSaleReceipt(sale)} style={{ padding: '0.3rem', borderRadius: '50%', border: 'none', background: 'transparent' }}>
                          <Share2 size={16} style={{ color: 'var(--primary)', cursor: 'pointer' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--success)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Pagamentos (Baixas)</h3>
            {customerPayments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Nenhum pagamento registrado.</p>
            ) : (
              <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.8rem', color: 'var(--text-muted)' }}>Data</th>
                    <th style={{ padding: '0.8rem', color: 'var(--text-muted)' }}>Método</th>
                    <th style={{ padding: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>Valor Baixado</th>
                  </tr>
                </thead>
                <tbody>
                  {customerPayments.map(pay => (
                    <tr key={pay.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.8rem' }}>{new Date(pay.date).toLocaleString()}</td>
                      <td style={{ padding: '0.8rem', textTransform: 'capitalize' }}>{pay.method === 'cash' ? 'Dinheiro' : pay.method === 'pix' ? 'PIX' : 'Cartão'}</td>
                      <td style={{ padding: '0.8rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--success)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                        R$ {pay.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        <button className="btn-secondary" title="Compartilhar Recibo" onClick={() => sharePaymentReceipt(pay, selectedHistoryCustomer?.name || 'Cliente')} style={{ padding: '0.3rem', borderRadius: '50%', border: 'none', background: 'transparent' }}>
                          <Share2 size={16} style={{ color: 'var(--primary)', cursor: 'pointer' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
}
