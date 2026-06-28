import { Search, Trash2, CheckCircle, X, Banknote, CreditCard, MapPin, ShoppingCart, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Customer, Product } from '../db/db';
import './Pos.css';

export default function Pos() {
  const [cart, setCart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const navigate = useNavigate();

  // UI states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState<string>('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [downPayment, setDownPayment] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pendingInstallments, setPendingInstallments] = useState<any[]>([]);

  const [products, setProducts] = useState<Product[]>([]);

  const loadData = async () => {
    try {
      const [prodRes, custRes] = await Promise.all([
        api.get('/products'),
        api.get('/customers')
      ]);
      setProducts(prodRes.data);
      setCustomers(custRes.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedCustomer) {
      api.get(`/installments?customerId=${selectedCustomer.id}&status=pending`)
        .then(res => {
           const installs = res.data;
           installs.sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
           setPendingInstallments(installs);
        })
        .catch(console.error);
    } else {
      setPendingInstallments([]);
    }
  }, [selectedCustomer]);

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1, selected_installments: 1 }]);
    }
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const updateItemInstallments = (id: number, selected_installments: number) => {
    setCart(cart.map(item => item.id === id ? { ...item, selected_installments } : item));
  };

  const currentTotal = cart.reduce((sum, item) => {
    const price = paymentMethod === 'cash' ? item.price_cash : item.price_credit;
    return sum + (price * item.quantity);
  }, 0);

  const filteredProducts = products.filter((p: Product) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 8); // limit results

  const filteredCustomers = customerSearch.trim() === '' ? [] : customers.filter((c: Customer) => {
    const term = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      (c.cpf && c.cpf.includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term));
  }).slice(0, 5);

  const handleDownPaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (!value) {
      setDownPayment('');
      return;
    }
    const floatValue = parseInt(value, 10) / 100;
    setDownPayment(floatValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const handleFinalizeSale = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'credit') {
      const forbiddenProducts = cart.filter(item => item.allow_credit === false);
      if (forbiddenProducts.length > 0) {
        setAlertMessage("Há itens no carrinho que NÃO permitem venda a prazo (fiado): " + forbiddenProducts.map(i => i.name).join(', '));
        return;
      }

      if (!selectedCustomer) {
        setAlertMessage("Para vendas a prazo/fiado, é obrigatório vincular um cliente!");
        return;
      }

      if (selectedCustomer.is_blocked) {
        setAlertMessage("Cliente bloqueado para compras a prazo!");
        return;
      }

      const availableCredit = selectedCustomer.credit_limit - selectedCustomer.credit_used;
      if (currentTotal > availableCredit) {
        setAlertMessage(`Limite insuficiente! Limite disponível: R$ ${availableCredit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
        return;
      }

      if (!showDueDateModal) {
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        setDueDate(defaultDate.toISOString().split('T')[0]);
        setShowDueDateModal(true);
        return;
      }
    }

    try {
      const allInstallments: any[] = [];
      if (paymentMethod === 'credit' && selectedCustomer?.id) {
        const [y, m, d] = dueDate.split('-');
        const baseYear = Number(y);
        const baseMonth = Number(m) - 1;
        const baseDay = Number(d);

        cart.forEach(item => {
          const amount = item.price_credit * item.quantity;
          
          const parsedDownPayment = parseFloat(downPayment.replace(/\./g, '').replace(',', '.')) || 0;
          const safeDownPayment = Math.min(parsedDownPayment, currentTotal);
          const itemRatio = currentTotal > 0 ? amount / currentTotal : 0;
          const itemDownPayment = safeDownPayment * itemRatio;
          const remainingAmount = amount - itemDownPayment;

          const installmentsCount = item.selected_installments || 1;
          const installmentValue = remainingAmount / installmentsCount;

          for (let i = 1; i <= installmentsCount; i++) {
            const dateObj = new Date(baseYear, baseMonth + (i - 1), baseDay);
            allInstallments.push({
              customerId: selectedCustomer.id,
              amount: installmentValue,
              due_date: dateObj,
              status: 'pending',
              number: i,
              total: installmentsCount,
              productName: item.name
            });
          }
        });
      }

      const payload = {
        customerId: selectedCustomer?.id,
        totalAmount: currentTotal,
        paymentMethod: paymentMethod,
        status: paymentMethod === 'credit' ? 'pending' : 'paid',
        date: new Date(saleDate + 'T12:00:00Z'),
        due_date: paymentMethod === 'credit' ? new Date(dueDate) : undefined,
        invoice_number: manualInvoiceNumber || undefined,
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price_applied: paymentMethod === 'cash' ? item.price_cash : item.price_credit
        })),
        installments: allInstallments
      };

      await api.post('/sales', payload);

      setCart([]);
      setSelectedCustomer(null);
      setPaymentMethod('cash');
      setCustomerSearch('');
      setSearchTerm('');
      setSaleDate(new Date().toISOString().split('T')[0]);
      setManualInvoiceNumber('');
      setDownPayment('');
      setShowDueDateModal(false);
      setShowSuccess(true);
      
      loadData();
      
      setTimeout(() => setShowSuccess(false), 3000);

    } catch (error) {
      console.error("Erro ao salvar venda:", error);
      setAlertMessage("Houve um erro ao tentar salvar a venda no banco de dados central.");
    }
  };

  return (
    <div className="pos-dashboard">
      <h1 className="page-title" style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.8rem', fontWeight: '700' }}>Ponto de Venda (PDV)</h1>
      <div className="pos-header-section glass-panel">
        <div className="customer-selection">
          <div style={{ flex: 2, position: 'relative' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '0.8rem', fontWeight: '600' }}>1. Selecione o Cliente (Opcional)</h3>
            <div className="search-box">
              <Search size={20} className="text-muted" />
              <input
                type="text"
                placeholder="Identificar Cliente por Nome, CPF ou Telefone..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
            {filteredCustomers.length > 0 && (
              <div className="customer-dropdown">
                {filteredCustomers.map(customer => (
                  <div key={customer.id} className={`customer-item ${customer.is_blocked ? 'blocked' : ''}`} onClick={() => handleSelectCustomer(customer)}>
                    <span className="customer-name-dropdown" title={customer.name}>{customer.name} {customer.is_loyal && <span style={{color: '#3b82f6', fontSize: '0.8rem', marginLeft: '8px', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px'}}>★ Fiel</span>}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="date-picker-box" style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '0.8rem', fontWeight: '600' }}>2. Data da Venda</h3>
            <input 
              type="date" 
              value={saleDate} 
              onChange={(e) => setSaleDate(e.target.value)} 
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem' }} 
            />
          </div>
        </div>

        <div className="customer-info-panel">
          {selectedCustomer ? (
            <div className="customer-details">
              <div className="info-block">
                <span className="label">Cliente</span>
                <strong className="value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {selectedCustomer.name}
                  {selectedCustomer.is_loyal && (
                    <span className="badge success" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '2px 6px', fontSize: '0.7rem' }}>★ Fiel</span>
                  )}
                </strong>
              </div>
              <div className="info-block">
                <span className="label">CPF/CNPJ</span>
                <strong className="value">{selectedCustomer.cpf || '-'}</strong>
              </div>
              <div className="info-block">
                <span className="label">Limite Livre</span>
                <strong className={`value ${selectedCustomer.credit_limit - selectedCustomer.credit_used < currentTotal ? 'text-danger' : 'text-success'}`}>
                  R$ {(selectedCustomer.credit_limit - selectedCustomer.credit_used).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button 
                  className="btn-location" 
                  title="Ver Endereço"
                  onClick={() => setShowAddressModal(true)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', transition: 'background 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <MapPin size={20} />
                </button>
                <button className="btn-remove-customer" onClick={handleClearCustomer} title="Remover Cliente">
                  <X size={20} />
                </button>
              </div>
            </div>
          ) : (
            <div className="no-customer-selected">
              <span>Venda Avulsa (Consumidor Final)</span>
            </div>
          )}
        </div>
      </div>

      <div className="pos-middle-section">
        <div className="history-panel glass-panel">
          <div className="panel-header">
            <h3>3. Títulos em Aberto</h3>
            {selectedCustomer && pendingInstallments.length > 0 && (
              <span className="badge-warning">{pendingInstallments.length} a pagar</span>
            )}
          </div>
          <div className="history-list">
            {!selectedCustomer ? (
              <div className="empty-state">Selecione um cliente para ver os títulos.</div>
            ) : pendingInstallments.length === 0 ? (
              <div className="empty-state">Nenhum título em aberto.</div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Cód. Compra</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInstallments.map(inst => (
                    <tr key={inst.id}>
                      <td style={{ color: 'var(--text-muted)' }}>#{inst.saleId}</td>
                      <td>{new Date(inst.due_date).toLocaleDateString('pt-BR')}</td>
                      <td className="text-warning font-bold">R$ {inst.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td>
                        <button className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--success)' }} onClick={() => navigate('/receipts', { state: { customerId: selectedCustomer.id } })}>Pagar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="pos-bottom-section glass-panel">
        <div className="products-selection-area">
          <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '1rem', fontWeight: '600' }}>4. Produtos da Venda</h3>
          <div className="product-search-box">
            <Search size={20} className="text-muted" />
            <input
              type="text"
              placeholder="Buscar Produto para Inserir..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="product-quick-list">
             {filteredProducts.map(product => (
               <div key={product.id} className="quick-product-card" onClick={() => addToCart(product)}>
                 <span>{product.name}</span>
                 <div className="prices">
                   <span className="price-cash">Din: R$ {product.price_cash.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                   <span className="price-credit">Prz: R$ {product.price_credit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                 </div>
               </div>
             ))}
             {searchTerm !== '' && filteredProducts.length === 0 && (
               <div className="empty-state">Produto não encontrado.</div>
             )}
          </div>
        </div>

        <div className="cart-area">
          <div className="cart-table-container">
            <div className="payment-method-selector-horizontal">
              <button
                className={`method-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                <Banknote size={18} /> Dinheiro/Pix
              </button>
              <button
                className={`method-btn ${paymentMethod === 'credit' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('credit')}
              >
                <CreditCard size={18} /> Prazo/Cartão
              </button>
            </div>
            <table className="cart-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Qtd</th>
                  <th>Produto</th>
                  <th>Valor Unit.</th>
                  {paymentMethod === 'credit' && <th>Parcelas</th>}
                  <th>Total</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cart-row">
                      <ShoppingCart size={32} />
                      <p>Adicione itens à venda atual</p>
                    </td>
                  </tr>
                ) : (
                  cart.map(item => {
                    const itemPrice = paymentMethod === 'cash' ? item.price_cash : item.price_credit;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="qty-controls">
                            <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                            <span>{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                          </div>
                        </td>
                        <td className="product-name-cell">{item.name}</td>
                        <td>R$ {itemPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                        {paymentMethod === 'credit' && (
                          <td>
                            {item.allow_credit !== false ? (
                              <select
                                value={item.selected_installments || 1}
                                onChange={(e) => updateItemInstallments(item.id, Number(e.target.value))}
                                className="installments-select"
                              >
                                {Array.from({ length: item.max_installments || 1 }).map((_, i) => (
                                  <option key={i+1} value={i+1}>{i+1}x</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-danger" style={{fontSize: '0.8rem'}}>Não permite fiado</span>
                            )}
                          </td>
                        )}
                        <td className="font-bold">R$ {(itemPrice * item.quantity).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                        <td>
                          <button className="btn-remove-item" onClick={() => setItemToDelete(item.id)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="checkout-sidebar checkout-footer" style={{ gap: '2rem' }}>
          <div className="manual-invoice-box" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginRight: 'auto' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Número da Nota (Manual)</label>
            <input 
              type="text" 
              placeholder="Ex: 00145 (Opcional)" 
              value={manualInvoiceNumber} 
              onChange={(e) => setManualInvoiceNumber(e.target.value)} 
              style={{ width: '100%', minWidth: '180px', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', fontSize: '1rem' }} 
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Se vazio, usa numeração online gerada.</span>
          </div>

          <div className="totals-block">
             <div className="total-row">
               <span>Subtotal:</span>
               <span>R$ {currentTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
             </div>
             <div className="total-row grand-total">
               <span>Total a Pagar:</span>
               <span className="value">R$ {currentTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
             </div>
          </div>

          <button
            className="btn-primary checkout-btn-large"
            disabled={cart.length === 0}
            onClick={handleFinalizeSale}
          >
            <CheckCircle size={20} />
            Finalizar Venda
          </button>
        </div>
      </div>

      {/* TOAST DE SUCESSO */}
      {showSuccess && (
        <div className="toast-success">
          <CheckCircle size={24} />
          <span>Venda Finalizada com Sucesso!</span>
        </div>
      )}

      {/* MODAL DE VENCIMENTO DO CREDIÁRIO */}
      {showDueDateModal && (
        <div className="modal-overlay" onClick={() => setShowDueDateModal(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirmar Vencimento</h2>
              <button className="close-modal" onClick={() => setShowDueDateModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                Esta venda está sendo lançada no crediário para <strong>{selectedCustomer?.name}</strong>.
              </p>
              <div className="form-group">
                <label>Data de Vencimento da Parcela/Fiado</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', marginTop: '0.5rem' }}
                />
              </div>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Valor de Entrada (Opcional - R$)</label>
                <input
                  type="text"
                  placeholder="Ex: 50,00"
                  value={downPayment}
                  onChange={handleDownPaymentChange}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', marginTop: '0.5rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button className="btn-secondary" onClick={() => setShowDueDateModal(false)} style={{ flex: 1 }}>Cancelar</button>
                <button className="btn-primary" onClick={handleFinalizeSale} style={{ flex: 2 }}>Confirmar Fiado</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAddressModal && selectedCustomer && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Endereço do Cliente</h3>
              <button className="btn-close" onClick={() => setShowAddressModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {(selectedCustomer.street || (selectedCustomer.address && selectedCustomer.address.street)) ? (
                <>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rua</label>
                    <div style={{ fontWeight: 500, fontSize: '1rem' }}>{selectedCustomer.street || selectedCustomer.address?.street}, Nº {selectedCustomer.number || selectedCustomer.address?.number}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bairro</label>
                    <div style={{ fontWeight: 500, fontSize: '1rem' }}>{selectedCustomer.neighborhood || selectedCustomer.address?.neighborhood}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cidade</label>
                      <div style={{ fontWeight: 500, fontSize: '1rem' }}>{selectedCustomer.city || selectedCustomer.address?.city} - {selectedCustomer.state || selectedCustomer.address?.state}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CEP</label>
                      <div style={{ fontWeight: 500, fontSize: '1rem' }}>{selectedCustomer.cep || selectedCustomer.address?.cep}</div>
                    </div>
                  </div>
                  {(selectedCustomer.observation || selectedCustomer.address?.observation) && (
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Observação</label>
                      <div style={{ fontWeight: 500, fontSize: '1rem' }}>{selectedCustomer.observation || selectedCustomer.address?.observation}</div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                  Nenhum endereço cadastrado para {selectedCustomer.name}.
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                  onClick={() => navigate('/customers', { state: { editCustomerId: selectedCustomer.id } })}
                >
                  Editar Cliente
                </button>
                <button 
                  className="btn-primary" 
                  style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                  onClick={() => setShowAddressModal(false)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALERTA CENTRALIZADO */}
      {alertMessage && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setAlertMessage(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: 'none', justifyContent: 'center', paddingBottom: '0' }}>
              <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '1rem' }} />
            </div>
            <div className="modal-body" style={{ padding: '0 1.5rem 2rem' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Atenção</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{alertMessage}</p>
              <button 
                className="btn-primary" 
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                onClick={() => setAlertMessage(null)}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO DE ITEM */}
      {itemToDelete !== null && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setItemToDelete(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: 'none', justifyContent: 'center', paddingBottom: '0' }}>
              <Trash2 size={48} color="var(--danger)" style={{ marginBottom: '1rem' }} />
            </div>
            <div className="modal-body" style={{ padding: '0 1.5rem 2rem' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Remover Item</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Tem certeza que deseja remover este item da venda?</p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                  onClick={() => setItemToDelete(null)}
                >
                  Cancelar
                </button>
                <button 
                  className="btn-primary" 
                  style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', background: 'var(--danger)', color: 'white', border: 'none', cursor: 'pointer' }}
                  onClick={() => {
                    removeFromCart(itemToDelete);
                    setItemToDelete(null);
                  }}
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
