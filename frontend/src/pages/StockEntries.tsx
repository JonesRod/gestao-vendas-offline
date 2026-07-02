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
}

interface StockEntryItem {
  productId: number;
  name: string;
  quantity: number;
  unitCost: number;
}

interface StockEntry {
  id: number;
  date: string;
  totalAmount: number;
  paymentMethod: string;
  supplier: string | null;
}

export default function StockEntries() {
  const [products, setProducts] = useState<Product[]>([]);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  
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

  useEffect(() => {
    fetchProducts();
    fetchEntries();
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
      fetchProducts(); // Atualiza custos
      fetchEntries();
      setAlertMessage('Entrada de estoque registrada com sucesso!');
      setActiveTab('history');
    } catch (error) {
      console.error('Erro ao registrar entrada de estoque:', error);
      setAlertMessage('Ocorreu um erro ao registrar a entrada de estoque.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.type !== 'KIT'
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
            <div className="form-group row align-end">
              <div className="col flex-2">
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
                <select 
                  value={selectedProductId} 
                  onChange={(e) => handleProductSelect(e.target.value)}
                  size={4}
                  className="product-select"
                >
                  {filteredProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - Preço final: {p.price_cash.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</option>
                  ))}
                </select>
              </div>
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
                      <td>
                        <button className="btn btn-danger btn-icon-small" onClick={() => handleRemoveItem(index)}>
                          <Trash2 size={16} />
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
            <div className="form-group row align-end">
              <div className="col">
                <label>Fornecedor (Opcional)</label>
                <input 
                  type="text" 
                  value={supplier} 
                  onChange={(e) => setSupplier(e.target.value)} 
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div className="col">
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
              <div className="col total-col">
                <span className="total-label">Total da Compra:</span>
                <span className="total-value">{totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
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
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Data</th>
                  <th>Fornecedor</th>
                  <th>Método</th>
                  <th>Total</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal isOpen={alertMessage !== null} onClose={() => setAlertMessage(null)} title="Aviso">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '20px', color: 'var(--text-main)' }}>{alertMessage}</p>
          <button className="btn-primary" style={{ padding: '10px 30px', fontSize: '1rem', borderRadius: '8px' }} onClick={() => setAlertMessage(null)}>OK</button>
        </div>
      </Modal>
    </div>
  );
}
