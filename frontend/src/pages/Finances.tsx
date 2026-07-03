import { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';
import { api } from '../services/api';
import './Finances.css';

interface Expense {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string | null;
  paymentMethod: string;
}

interface Sale {
  id: number;
  totalAmount: number;
  paymentMethod: string;
}

interface Payment {
  id: number;
  amount: number;
}

export default function Finances() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Novo formulário
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [type, setType] = useState('EXPENSE');
  const [category, setCategory] = useState('');
  const PAYMENT_OPTIONS = [
    { id: 'dinheiro', label: 'Dinheiro' },
    { id: 'pix', label: 'PIX' },
    { id: 'cartao_credito', label: 'Cartão de Crédito' },
    { id: 'cartao_debito', label: 'Cartão de Débito' },
    { id: 'boleto', label: 'Boleto' }
  ];

  const [splitPayments, setSplitPayments] = useState<Record<string, number>>({ dinheiro: 0 });

  const fetchData = async () => {
    try {
      const [expensesRes, salesRes, paymentsRes] = await Promise.all([
        api.get('/expenses'),
        api.get('/sales'),
        api.get('/payments')
      ]);
      setExpenses(expensesRes.data);
      setSales(salesRes.data);
      setPayments(paymentsRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados financeiros:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || amount <= 0) {
      alert('Preencha a descrição e um valor válido.');
      return;
    }

    const methods = Object.keys(splitPayments);
    if (methods.length === 0) {
      alert('Selecione pelo menos um método de pagamento.');
      return;
    }

    const sum = methods.reduce((acc, method) => acc + splitPayments[method], 0);
    // Allowing a small floating point margin
    if (Math.abs(sum - amount) > 0.01) {
      alert(`A soma dos pagamentos (R$ ${sum.toFixed(2)}) não bate com o valor total (R$ ${amount.toFixed(2)}).`);
      return;
    }

    let finalPaymentMethodStr = '';
    if (methods.length === 1 && sum === amount) {
      finalPaymentMethodStr = methods[0];
    } else {
      const splitArr = methods.map(m => ({ method: m, amount: splitPayments[m] })).filter(m => m.amount > 0);
      finalPaymentMethodStr = JSON.stringify(splitArr);
    }

    setLoading(true);
    try {
      await api.post('/expenses', {
        description,
        amount: Number(amount),
        type,
        category,
        paymentMethod: finalPaymentMethodStr
      });
      alert('Registro adicionado com sucesso!');
      setDescription('');
      setAmount(0);
      setCategory('');
      setSplitPayments({ dinheiro: 0 });
      fetchData();
    } catch (error) {
      console.error('Erro ao registrar:', error);
      alert('Erro ao registrar finança.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir:', error);
    }
  };

  const totalGastos = expenses
    .filter(e => e.type === 'EXPENSE' || e.type === 'STOCK_PURCHASE' || e.type === 'COST')
    .reduce((acc, curr) => acc + curr.amount, 0);

  let totalEntradas = 0;
  
  payments.forEach(p => {
    totalEntradas += p.amount;
  });

  sales.forEach(s => {
    try {
      const parsed = JSON.parse(s.paymentMethod);
      if (Array.isArray(parsed)) {
        parsed.forEach(m => {
          if (m.method !== 'fiado') totalEntradas += m.amount;
        });
      }
    } catch {
      if (s.paymentMethod !== 'fiado') {
        totalEntradas += s.totalAmount;
      }
    }
  });

  const saldo = totalEntradas - totalGastos;

  return (
    <div className="finances-container">
      <header className="page-header">
        <h1>Finanças e Despesas</h1>
      </header>

      <div className="dashboard-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        <div className="summary-card success">
          <div className="summary-icon">
            <TrendingUp size={24} />
          </div>
          <div className="summary-info">
            <span className="summary-title">Total de Entradas</span>
            <span className="summary-value">{totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>

        <div className="summary-card danger">
          <div className="summary-icon">
            <TrendingDown size={24} />
          </div>
          <div className="summary-info">
            <span className="summary-title">Total de Gastos/Custos</span>
            <span className="summary-value">{totalGastos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>

        <div className={`summary-card ${saldo >= 0 ? 'success' : 'danger'}`}>
          <div className="summary-icon">
            <DollarSign size={24} />
          </div>
          <div className="summary-info">
            <span className="summary-title">Saldo Atual</span>
            <span className="summary-value">{saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>
      </div>

      <div className="content-grid">
        <div className="card form-card">
          <h2>Novo Registro</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Tipo</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="EXPENSE">Despesa (Geral)</option>
                <option value="COST">Custo Fixo/Variável</option>
              </select>
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <input 
                type="text" 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Ex: Conta de Luz, Material de Limpeza..."
                required
              />
            </div>
            <div className="form-group">
              <label>Valor Total (R$)</label>
              <input 
                type="text" 
                value={amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                onChange={e => {
                  const value = e.target.value.replace(/\D/g, '');
                  const numericValue = parseInt(value, 10) / 100;
                  const newAmount = isNaN(numericValue) ? 0 : numericValue;
                  setAmount(newAmount);
                  // If there's only one payment method checked, update its value automatically
                  const methods = Object.keys(splitPayments);
                  if (methods.length === 1) {
                    setSplitPayments({ [methods[0]]: newAmount });
                  }
                }} 
                required
              />
            </div>
            <div className="form-group">
              <label>Categoria (Opcional)</label>
              <input 
                type="text" 
                value={category} 
                onChange={e => setCategory(e.target.value)} 
                placeholder="Ex: Operacional, Marketing..."
              />
            </div>
            
            <div className="form-group">
              <label style={{ marginBottom: '10px' }}>Métodos de Pagamento</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-main)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {PAYMENT_OPTIONS.map(opt => {
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

            <button type="submit" className="btn btn-primary full-width mt-4" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrar'}
            </button>
          </form>
        </div>

        <div className="card list-card">
          <h2>Histórico Financeiro</h2>
          {expenses.length === 0 ? (
            <p className="empty-msg">Nenhum registro encontrado.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Valor</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id}>
                      <td>{new Date(exp.date).toLocaleDateString()}</td>
                      <td>
                        {exp.description}
                        {exp.type === 'STOCK_PURCHASE' && <span className="badge badge-stock">Estoque</span>}
                      </td>
                      <td>{exp.category || '-'}</td>
                      <td className="text-danger font-bold">
                        - {exp.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td>
                        <button 
                          onClick={() => handleDelete(exp.id)} 
                          title="Excluir"
                          style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
