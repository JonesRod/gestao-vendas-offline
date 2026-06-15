import { AlertCircle, Banknote, CheckCircle, CreditCard, Search, ShoppingCart, Trash2, UserCheck, UserPlus, X, FileText, Printer } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Customer, Product, Sale } from '../db/db';
import './Pos.css';

export default function Pos() {
  const [cart, setCart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');

  // UI states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [dueDate, setDueDate] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [pendingSales, setPendingSales] = useState<Sale[]>([]);

  const loadData = async () => {
    try {
      const [prodRes, custRes, salesRes] = await Promise.all([
        api.get('/products'),
        api.get('/customers'),
        api.get('/sales')
      ]);
      setProducts(prodRes.data);
      setCustomers(custRes.data);
      setAllSales(salesRes.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedCustomer) {
      const pending = allSales.filter(s => s.customerId === selectedCustomer.id && s.status === 'pending');
      setPendingSales(pending);
    } else {
      setPendingSales([]);
    }
  }, [selectedCustomer, allSales]);

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

  const handleFinalizeSale = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'credit') {
      const forbiddenProducts = cart.filter(item => item.allow_credit === false);
      if (forbiddenProducts.length > 0) {
        alert("Há itens no carrinho que NÃO permitem venda a prazo (fiado): " + forbiddenProducts.map(i => i.name).join(', '));
        return;
      }

      if (!selectedCustomer) {
        alert("Para vendas a prazo/fiado, é obrigatório vincular um cliente!");
        return;
      }

      if (selectedCustomer.is_blocked) {
        alert("Cliente bloqueado para compras a prazo!");
        return;
      }

      const availableCredit = selectedCustomer.credit_limit - selectedCustomer.credit_used;
      if (currentTotal > availableCredit) {
        alert(`Limite insuficiente! Limite disponível: R$ ${availableCredit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
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
          const installmentsCount = item.selected_installments || 1;
          const installmentValue = amount / installmentsCount;

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
        date: new Date(),
        due_date: paymentMethod === 'credit' ? new Date(dueDate) : undefined,
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
      setShowDueDateModal(false);
      setShowSuccess(true);
      
      loadData();
      
      setTimeout(() => setShowSuccess(false), 3000);

    } catch (error) {
      console.error("Erro ao salvar venda:", error);
      alert("Houve um erro ao tentar salvar a venda no banco de dados central.");
    }
  };

  return (
    <div className="pos-dashboard">
      <div className="pos-header-section glass-panel">
        <div className="customer-selection">
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
                  <span>{customer.name} - {customer.phone}</span>
                  <span className={customer.credit_limit - customer.credit_used <= 0 ? 'text-danger' : 'text-success'}>
                    Livre: R$ {(customer.credit_limit - customer.credit_used).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="customer-info-panel">
          {selectedCustomer ? (
            <div className="customer-details">
              <div className="info-block">
                <span className="label">Cliente</span>
                <strong className="value">{selectedCustomer.name}</strong>
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
              <button className="btn-remove-customer" onClick={handleClearCustomer} title="Remover Cliente">
                <X size={20} />
              </button>
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
            <h3>Histórico de Compras a Prazo</h3>
            {selectedCustomer && pendingSales.length > 0 && (
              <span className="badge-warning">{pendingSales.length} em aberto</span>
            )}
          </div>
          <div className="history-list">
            {!selectedCustomer ? (
              <div className="empty-state">Selecione um cliente para ver o histórico.</div>
            ) : pendingSales.length === 0 ? (
              <div className="empty-state">Nenhuma compra a prazo em aberto.</div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSales.map(sale => (
                    <tr key={sale.id}>
                      <td>{new Date(sale.date).toLocaleDateString()}</td>
                      <td className="text-warning font-bold">R$ {sale.totalAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td>Aguardando</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="actions-panel glass-panel">
          <h3>Ações Rápidas</h3>
          <div className="action-buttons">
            <button className="btn-action" disabled={!selectedCustomer}>
              <Banknote size={24} />
              Receber Conta
            </button>
            <button className="btn-action" disabled={!selectedCustomer}>
              <Printer size={24} />
              Imprimir Comprovantes
            </button>
          </div>
        </div>
      </div>

      <div className="pos-bottom-section glass-panel">
        <div className="products-selection-area">
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
                          <button className="btn-remove-item" onClick={() => removeFromCart(item.id)}>
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

          <div className="checkout-sidebar">
            <div className="payment-method-selector-horizontal">
              <button
                className={`method-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                <Banknote size={18} /> Din/Pix
              </button>
              <button
                className={`method-btn ${paymentMethod === 'credit' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('credit')}
              >
                <CreditCard size={18} /> Prazo/Cartão
              </button>
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
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button className="btn-secondary" onClick={() => setShowDueDateModal(false)} style={{ flex: 1 }}>Cancelar</button>
                <button className="btn-primary" onClick={handleFinalizeSale} style={{ flex: 2 }}>Confirmar Fiado</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
