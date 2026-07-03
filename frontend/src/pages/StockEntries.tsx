import { useState, useEffect } from 'react';
import { Plus, Trash2, Search, PackagePlus } from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../services/api';
import './StockEntries.css';

interface Product {
  id: number;
  name: string;
  cost: number;
  price_cash: number;
  type?: string;
  description?: string;
  images?: string[];
}

interface StockEntryItem {
  productId: number;
  name: string;
  quantity: number;
  unitCost: number;
}

interface Supplier {
  id: number;
  name: string;
  trade_name?: string;
}

interface StockEntry {
  id: number;
  date: string;
  totalAmount: number;
  paymentMethod: string;
  supplier: string | null;
  items?: {
    quantity: number;
    unitCost: number;
    product: {
      name: string;
    };
  }[];
}

export default function StockEntries() {
  const [products, setProducts] = useState<Product[]>([]);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // Formulário de nova entrada
  const [items, setItems] = useState<StockEntryItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [splitPayments, setSplitPayments] = useState<Record<string, number>>({ dinheiro: 0 });
  const [supplier, setSupplier] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [searchTerm, setSearchTerm] = useState('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<StockEntry | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchEntries();
    fetchSuppliers();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
    }
  };

  const fetchEntries = async () => {
    try {
      const response = await api.get('/stock-entries');
      setEntries(response.data);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
    }
  };

  const handleSplitChange = (method: string, valueStr: string) => {
    const value = valueStr.replace(/\D/g, '');
    const numericValue = parseInt(value, 10) / 100;
    setSplitPayments(prev => ({
      ...prev,
      [method]: isNaN(numericValue) ? 0 : numericValue
    }));
  };

  const togglePaymentMethod = (method: string) => {
    setSplitPayments(prev => {
      const next = { ...prev };
      if (next[method] !== undefined) {
        delete next[method];
      } else {
        next[method] = 0;
      }
      return next;
    });
  };

  const handleProductSelect = (id: string) => {
    setSelectedProductId(id);
    const prod = products.find(p => p.id === Number(id));
    if (prod) {
      setUnitCost(prod.cost || 0);
    }
  };

  const handleAddItem = () => {
    if (!selectedProductId || quantity <= 0 || unitCost < 0) {
      setAlertMessage('Selecione um produto, quantidade válida e custo.');
      return;
    }
    const prod = products.find(p => p.id === Number(selectedProductId));
    if (!prod) return;

    setItems([...items, {
      productId: prod.id,
      name: prod.name,
      quantity: Number(quantity),
      unitCost: Number(unitCost)
    }]);

    setSelectedProductId('');
    setSearchTerm('');
    setQuantity(1);
    setUnitCost(0);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0);

  useEffect(() => {
    const methods = Object.keys(splitPayments);
    if (methods.length === 1) {
      setSplitPayments({ [methods[0]]: totalAmount });
    }
  }, [totalAmount]);

  const handleSubmit = async () => {
    if (items.length === 0) {
      setAlertMessage('Adicione pelo menos um produto.');
      return;
    }
    
    if (!supplier.trim()) {
      setAlertMessage('O fornecedor é obrigatório.');
      return;
    }
    
    const methods = Object.keys(splitPayments);
    if (methods.length === 0) {
      setAlertMessage('Selecione pelo menos um método de pagamento.');
      return;
    }

    const sum = methods.reduce((acc, method) => acc + splitPayments[method], 0);
    // Allowing a small floating point margin
    if (Math.abs(sum - totalAmount) > 0.01) {
      setAlertMessage(`A soma dos pagamentos (R$ ${sum.toFixed(2)}) não bate com o valor total da compra (R$ ${totalAmount.toFixed(2)}).`);
      return;
    }

    let finalPaymentMethodStr = '';
    if (methods.length === 1 && sum === totalAmount) {
      finalPaymentMethodStr = methods[0];
    } else {
      const splitArr = methods.map(m => ({ method: m, amount: splitPayments[m] })).filter(m => m.amount > 0);
      finalPaymentMethodStr = JSON.stringify(splitArr);
    }

    setShowConfirmModal(true);
  };

  const executeSubmit = async () => {
    const methods = Object.keys(splitPayments);
    const sum = methods.reduce((acc, method) => acc + splitPayments[method], 0);
    let finalPaymentMethodStr = '';
    if (methods.length === 1 && sum === totalAmount) {
      finalPaymentMethodStr = methods[0];
    } else {
      const splitArr = methods.map(m => ({ method: m, amount: splitPayments[m] })).filter(m => m.amount > 0);
      finalPaymentMethodStr = JSON.stringify(splitArr);
    }

    setLoading(true);
    try {
      await api.post('/stock-entries', {
        items,
        totalAmount,
        paymentMethod: finalPaymentMethodStr,
        supplier,
        notes: ''
      });
      setItems([]);
      setSupplier('');
      setSplitPayments({ dinheiro: 0 });
      setSearchTerm('');
      setSelectedProductId('');
      setQuantity(1);
      setUnitCost(0);
      fetchProducts(); // Atualiza custos
      fetchEntries();
      setShowConfirmModal(false);
    } catch (error) {
      console.error('Erro ao registrar entrada de estoque:', error);
      setAlertMessage('Ocorreu um erro ao registrar a entrada de estoque.');
      setShowConfirmModal(false);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.type !== 'kit'
  );

  return (
    <div className="stock-entries-container">
      <header className="page-header">
        <h1>Entrada de Estoque</h1>
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => setActiveTab('new')}
          >
            Nova Entrada
          </button>
          <button 
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Histórico
          </button>
        </div>
      </header>

      {activeTab === 'new' && (
        <div className="new-entry-section">
          <div className="add-item-form card">
            <h2>Adicionar Produto</h2>
            <div className="form-group row">
              <div className="col" style={{ flex: 1, position: 'relative' }}>
                <label>Produto</label>
                <div className="search-input-wrapper">
                  <Search className="input-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar produto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {searchTerm.length > 0 && (
                  <div className="product-search-results">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map(p => (
                        <div 
                          key={p.id} 
                          className={`product-search-item ${selectedProductId === String(p.id) ? 'selected' : ''}`}
                          onClick={() => handleProductSelect(String(p.id))}
                        >
                          <div className="product-search-image">
                            {p.images && p.images.length > 0 ? (
                              <img src={p.images[0]} alt={p.name} />
                            ) : (
                              <div className="no-image-placeholder"><PackagePlus size={24} /></div>
                            )}
                          </div>
                          <div className="product-search-info">
                            <span className="product-search-name">{p.name}</span>
                            {p.description && <span className="product-search-desc">{p.description}</span>}
                            <span className="product-search-price">Preço final: {p.price_cash.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="product-search-empty">Nenhum produto encontrado.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="form-group row align-end mt-4">
              <div className="col">
                <label>Qtd</label>
                <input 
                  type="number" 
                  min="1" 
                  value={quantity} 
                  onChange={(e) => setQuantity(Number(e.target.value))} 
                />
              </div>
              <div className="col">
                <label>Custo Unit. (R$)</label>
                <input 
                  type="text" 
                  value={unitCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  onChange={e => {
                    const value = e.target.value.replace(/\D/g, '');
                    const numericValue = parseInt(value, 10) / 100;
                    setUnitCost(isNaN(numericValue) ? 0 : numericValue);
                  }}
                />
              </div>
              <div className="col">
                <label>Total (R$)</label>
                <input 
                  type="text" 
                  value={(quantity * unitCost).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  disabled
                  style={{ backgroundColor: 'transparent', color: 'var(--text-main)', opacity: 0.7 }}
                />
              </div>
              <div className="col add-btn-col">
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }} onClick={handleAddItem}>
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="items-list card">
            <h2>Lista de Entrada</h2>
            {items.length === 0 ? (
              <div className="empty-state">
                <PackagePlus size={48} />
                <p>Nenhum produto adicionado à lista.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Qtd</th>
                    <th>Custo Unit.</th>
                    <th>Subtotal</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td>{(item.quantity * item.unitCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => handleRemoveItem(index)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '5px' }}
                          title="Remover"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="checkout-section card">
            <h2>Finalizar Entrada</h2>
            <div className="form-group row">
              <div className="col" style={{ flex: 1 }}>
                <label>Fornecedor *</label>
                <input 
                  type="text" 
                  list="suppliers-list"
                  value={supplier} 
                  onChange={(e) => setSupplier(e.target.value)} 
                  placeholder="Buscar fornecedor..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-main)' }}
                  required
                />
                <datalist id="suppliers-list">
                  {suppliers.map(s => (
                    <option key={s.id} value={s.trade_name ? `${s.name} (${s.trade_name})` : s.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="form-group row mt-4" style={{ justifyContent: 'flex-start' }}>
              <div className="col total-col" style={{ justifyContent: 'flex-start', flex: 1, padding: '10px', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span className="total-label">Total da Compra:</span>
                <span className="total-value">{totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            <div className="form-group row mt-4">
              <div className="col" style={{ flex: 1 }}>
                <label style={{ marginBottom: '10px' }}>Métodos de Pagamento</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-main)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  {[
                    { id: 'dinheiro', label: 'Dinheiro' },
                    { id: 'pix', label: 'PIX' },
                    { id: 'cartao_credito', label: 'Cartão Crédito' },
                    { id: 'cartao_debito', label: 'Cartão Débito' },
                    { id: 'boleto', label: 'Boleto/Transf.' }
                  ].map(opt => {
                    const isChecked = splitPayments[opt.id] !== undefined;
                    return (
                      <div key={opt.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px', cursor: 'pointer', margin: 0 }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => togglePaymentMethod(opt.id)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: isChecked ? 600 : 400 }}>{opt.label}</span>
                        </label>
                        {isChecked && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '100%', paddingLeft: '26px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>R$</span>
                            <input 
                              type="text"
                              value={splitPayments[opt.id].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              onChange={e => handleSplitChange(opt.id, e.target.value)}
                              style={{ width: '100%', maxWidth: '200px', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-main)' }}
                              required
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <button 
              className="btn-primary full-width mt-4" 
              onClick={handleSubmit}
              disabled={loading || items.length === 0}
              style={{
                padding: '16px',
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: '8px',
                opacity: (loading || items.length === 0) ? 0.6 : 1,
                cursor: (loading || items.length === 0) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              {loading ? 'Registrando...' : 'Confirmar Entrada no Estoque'}
            </button>
            <p className="hint">
              * O preço de venda dos produtos selecionados não será alterado. A margem de lucro será recalculada automaticamente com base no novo custo.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-section card">
          <h2>Histórico de Entradas</h2>
          {entries.length === 0 ? (
            <p>Nenhuma entrada registrada.</p>
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Data</th>
                    <th>Fornecedor</th>
                    <th>Método</th>
                    <th>Total</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id}>
                      <td>#{entry.id}</td>
                      <td>{new Date(entry.date).toLocaleString()}</td>
                      <td>{entry.supplier || '-'}</td>
                      <td>{entry.paymentMethod}</td>
                      <td className="bold">{entry.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn-icon" 
                          onClick={() => setSelectedEntry(entry)}
                          title="Ver detalhes"
                        >
                          <Search size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirmação">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '20px', color: 'var(--text-main)' }}>Deseja realmente confirmar esta entrada de estoque?</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="btn-secondary" onClick={() => setShowConfirmModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={executeSubmit} disabled={loading}>
              {loading ? 'Confirmando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={alertMessage !== null} onClose={() => setAlertMessage(null)} title="Aviso">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '20px', color: 'var(--text-main)' }}>{alertMessage}</p>
          <button className="btn-primary full-width" onClick={() => setAlertMessage(null)}>OK</button>
        </div>
      </Modal>

      <Modal isOpen={selectedEntry !== null} onClose={() => setSelectedEntry(null)} title={`Detalhes da Entrada #${selectedEntry?.id}`}>
        {selectedEntry && (
          <div style={{ padding: '10px' }}>
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '5px', color: 'var(--text-muted)' }}>
              <p><strong>Data:</strong> {new Date(selectedEntry.date).toLocaleString()}</p>
              <p><strong>Fornecedor:</strong> {selectedEntry.supplier || 'Não informado'}</p>
              <p><strong>Total:</strong> {selectedEntry.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              <p><strong>Método de Pagamento:</strong> {selectedEntry.paymentMethod}</p>
            </div>
            
            <h4 style={{ marginBottom: '10px', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>Itens da Compra</h4>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Qtd</th>
                    <th>Custo Unit.</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEntry.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.product?.name || 'Desconhecido'}</td>
                      <td>{item.quantity}</td>
                      <td>{item.unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td>{(item.quantity * item.unitCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
