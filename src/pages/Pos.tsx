import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, Banknote, CheckCircle, CreditCard, Search, ShoppingCart, Trash2, UserCheck, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { db, type Customer, type Product, type Sale } from '../db/db';
import './Pos.css';

export default function Pos() {
  const [posStep, setPosStep] = useState<'select_customer' | 'customer_dashboard' | 'shopping'>('select_customer');
  const [pendingSales, setPendingSales] = useState<Sale[]>([]);

  const [cart, setCart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // UI states
  const [showSuccess, setShowSuccess] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [dueDate, setDueDate] = useState('');

  const products = useLiveQuery(() => db.products.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    if (customer.credit_used > 0) {
      const sales = await db.sales.where('customerId').equals(customer.id!).toArray();
      const pending = sales.filter(s => s.status === 'pending');
      setPendingSales(pending);
      setPosStep('customer_dashboard');
    } else {
      setPosStep('shopping');
    }
  };

  const handleStartWithoutCustomer = () => {
    setSelectedCustomer(null);
    setPosStep('shopping');
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
  );

  const filteredCustomers = customers.filter((c: Customer) => {
    const term = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      (c.cpf && c.cpf.includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term));
  });

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
        // Padroniza a data inicial para 30 dias a partir da data atual
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);

        setDueDate(defaultDate.toISOString().split('T')[0]);
        setShowDueDateModal(true);
        return;
      }
    }

    try {
      const saleId = await db.sales.add({
        customerId: selectedCustomer?.id,
        totalAmount: currentTotal,
        paymentMethod: paymentMethod,
        status: paymentMethod === 'credit' ? 'pending' : 'paid',
        date: new Date(),
        due_date: paymentMethod === 'credit' ? new Date(dueDate) : undefined
      });

      const saleItems = cart.map(item => {
        const price = paymentMethod === 'cash' ? item.price_cash : item.price_credit;
        if (item.id) {
          db.products.update(item.id, {
            stock: item.stock - item.quantity
          });
        }
        return {
          saleId: saleId as number,
          productId: item.id,
          quantity: item.quantity,
          price_applied: price
        };
      });

      await db.saleItems.bulkAdd(saleItems);

      if (paymentMethod === 'credit' && selectedCustomer?.id) {
        await db.customers.update(selectedCustomer.id, {
          credit_used: selectedCustomer.credit_used + currentTotal
        });

        const allInstallments: any[] = [];
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
              saleId: saleId,
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

        await db.installments.bulkAdd(allInstallments);
      }

      setCart([]);
      setSelectedCustomer(null);
      setPaymentMethod('cash');
      setCustomerSearch('');
      setShowDueDateModal(false);
      setPosStep('select_customer');
      setShowSuccess(true);

      setTimeout(() => setShowSuccess(false), 3000);

    } catch (error) {
      console.error("Erro ao salvar venda:", error);
      alert("Houve um erro ao tentar salvar a venda.");
    }
  };

  if (posStep === 'select_customer') {
    return (
      <div className="pos-welcome-screen">
        <div className="welcome-card glass-panel">
          <div className="welcome-header">
            <UserCheck size={32} className="text-primary" />
            <h2>Identificar Cliente</h2>
            <p>Busque clientes por nome, telefone, CPF ou e-mail.</p>
          </div>

          <div className="modal-search" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '1rem', marginTop: '1.5rem' }}>
            <Search size={20} className="text-muted" />
            <input
              type="text"
              placeholder="Digite para buscar..."
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              autoFocus
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', marginLeft: '1rem', outline: 'none', fontSize: '1rem' }}
            />
          </div>

          <div className="welcome-customer-list">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.slice(0, 5).map(customer => {
                const available = customer.credit_limit - customer.credit_used;
                return (
                  <div key={customer.id} className={`user-list-item ${customer.is_blocked ? 'blocked' : ''}`} onClick={() => handleSelectCustomer(customer)}>
                    <div className="user-list-info">
                      <strong>{customer.name}</strong>
                      <span>{customer.phone} {customer.cpf ? `| ${customer.cpf}` : ''}</span>
                    </div>
                    <div className="user-list-credit">
                      <span className="label">Livre:</span>
                      <span className={`value ${available <= 0 || customer.is_blocked ? 'danger' : 'success'}`}>
                        R$ {available.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="no-results" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                Nenhum cliente encontrado.
              </p>
            )}
          </div>

          <div className="welcome-footer">
            <button className="btn-secondary" onClick={handleStartWithoutCustomer} style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}>
              Venda Avulsa (Consumidor Final)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (posStep === 'customer_dashboard') {
    return (
      <div className="pos-dashboard-screen">
        <div className="dashboard-content glass-panel">
          <div className="dashboard-header-block">
            {selectedCustomer!.credit_used >= selectedCustomer!.credit_limit ? (
              <>
                <AlertCircle size={40} className="text-danger" />
                <h2>Atenção: Limite Excedido</h2>
                <p><strong>{selectedCustomer?.name}</strong> não possui mais limite disponível.</p>
              </>
            ) : (
              <>
                <UserCheck size={40} className="text-primary" />
                <h2>Faturas em Aberto (Fiado)</h2>
                <p><strong>{selectedCustomer?.name}</strong> possui compras a prazo aguardando acerto.</p>
              </>
            )}

            <div className={`debt-amount-big ${selectedCustomer!.credit_used >= selectedCustomer!.credit_limit ? 'text-danger' : 'text-warning'}`}>
              Crédito Utilizado: R$ {selectedCustomer?.credit_used.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            <div style={{ fontSize: '1.25rem', color: 'var(--success)', fontWeight: 700, marginTop: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              Crédito Disponível (Livre): R$ {(selectedCustomer!.credit_limit - selectedCustomer!.credit_used).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
          </div>

          <h3 style={{ margin: '1.5rem 0 1rem' }}>Lista de Compras a Prazo (Em Aberto)</h3>
          <div className="pending-sales-list">
            {pendingSales.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhum histórico detalhado, apenas saldo devedor.</p>}
            {pendingSales.map(sale => (
              <div key={sale.id} className="pending-sale-card glass-panel" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', marginBottom: '0.5rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>Data da Compra: {new Date(sale.date).toLocaleDateString()}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status: Aguardando Pagamento</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, color: 'var(--warning)', fontSize: '1.1rem' }}>
                  R$ {sale.totalAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button className="btn-secondary" onClick={() => setPosStep('select_customer')} style={{ flex: 1 }}>Voltar</button>
            <button className="btn-primary" onClick={() => setPosStep('shopping')} style={{ flex: 2 }}>
              Prosseguir e Liberar Nova Venda
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pos-container">
      <div className="pos-main">
        <div className="page-header" style={{ marginBottom: '1rem' }}>
          <h1 className="page-title">Ponto de Venda</h1>
        </div>

        <div className="search-bar glass-panel">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar cestas, gás ou produtos avulsos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="products-grid">
          {filteredProducts.map((product: Product) => (
            <div key={product.id} className="product-card glass-panel" onClick={() => addToCart(product)}>
              <div className="product-type-badge">{product.type === 'kit' ? 'Cesta' : 'Avulso'}</div>
              <h3 className="product-name">{product.name}</h3>
              <div className="product-prices">
                <div className="price-item">
                  <span className="price-label">Din/Pix</span>
                  <span className="price-value">R$ {product.price_cash.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div className="price-item">
                  <span className="price-label">Prazo</span>
                  <span className="price-value credit">R$ {product.price_credit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              </div>
              <p className="product-stock">Estoque: {product.stock}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pos-sidebar glass-panel">
        <div className="cart-header">
          <h2>Carrinho Atual</h2>
          <ShoppingCart size={24} />
        </div>

        <div className="customer-selector">
          {selectedCustomer ? (
            <div className="selected-customer-box">
              <div className="info">
                <strong>{selectedCustomer.name}</strong>
                {paymentMethod === 'credit' && (
                  <span className={`limit ${selectedCustomer.credit_limit - selectedCustomer.credit_used < currentTotal ? 'danger' : 'success'}`}>
                    Limite: R$ {(selectedCustomer.credit_limit - selectedCustomer.credit_used).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </span>
                )}
              </div>
              <button className="remove-customer" onClick={() => {
                setSelectedCustomer(null);
                setPosStep('select_customer');
              }}>
                <X size={18} />
              </button>
            </div>
          ) : (
            <button className="btn-secondary" onClick={() => setPosStep('select_customer')}>
              <UserPlus size={18} />
              Vincular Cliente
            </button>
          )}
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <ShoppingCart size={48} />
              <p>Adicione itens ao carrinho</p>
            </div>
          ) : (
            cart.map(item => {
              const itemPrice = paymentMethod === 'cash' ? item.price_cash : item.price_credit;
              return (
                <div key={item.id} className="cart-item">
                  <div className="item-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 500, maxWidth: '65%', lineHeight: 1.3 }}>{item.name}</h4>
                      <span className="item-price" style={{ fontWeight: 700, color: 'var(--primary)' }}>R$ {(itemPrice * item.quantity).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  </div>

                  {paymentMethod === 'credit' && item.allow_credit !== false && (
                    <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Parcelamento ({item.max_installments}x máx):</label>
                      <select
                        value={item.selected_installments || 1}
                        onChange={(e) => updateItemInstallments(item.id, Number(e.target.value))}
                        style={{ width: '100%', padding: '4px', marginTop: '4px', borderRadius: '4px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', outline: 'none' }}
                      >
                        {Array.from({ length: item.max_installments || 1 }).map((_, i) => {
                          const parcelValue = (itemPrice * item.quantity) / (i + 1);
                          return (
                            <option key={i + 1} value={i + 1} style={{ color: 'black' }}>
                              {i + 1}x de R$ {parcelValue.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {paymentMethod === 'credit' && item.allow_credit === false && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                      🚫 Este produto não permite venda a prazo.
                    </div>
                  )}

                  <div className="item-actions">
                    <div className="quantity-controls">
                      <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                    </div>
                    <button className="btn-remove" onClick={() => removeFromCart(item.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="cart-footer">
          <div className="payment-method-selector">
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

          <div className="cart-total">
            <span>Total:</span>
            <h3>R$ {currentTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
          </div>

          <button
            className="btn-primary checkout-btn"
            disabled={cart.length === 0}
            onClick={handleFinalizeSale}
          >
            Finalizar Venda
          </button>
        </div>
      </div>

      {/* TOAST DE SUCESSO */}
      {showSuccess && (
        <div className="toast-success">
          <CheckCircle size={24} />
          <span>Venda Finalizada!</span>
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
