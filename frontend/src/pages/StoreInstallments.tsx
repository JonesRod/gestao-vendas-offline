import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle, Clock, X, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StoreInstallments() {
  const { user } = useAuth();
  const [installments, setInstallments] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payingInst, setPayingInst] = useState<any | null>(null);

  // Estados do Modal
  const [discountAmount, setDiscountAmount] = useState(0);
  const [penaltyAmount, setPenaltyAmount] = useState(0);
  const [interestAmount, setInterestAmount] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [nextDueDate, setNextDueDate] = useState('');
  const [splitPayments, setSplitPayments] = useState<Record<string, number>>({});

  const maskCurrency = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parseCurrency = (value: string) => {
    const numericValue = parseInt(value.replace(/\D/g, ''), 10) / 100;
    return isNaN(numericValue) ? 0 : numericValue;
  };

  useEffect(() => {
    loadInstallments();
  }, [user]);

  const loadInstallments = async () => {
    if (!user?.id) return;
    try {
      const [instRes, settRes] = await Promise.all([
        api.get(`/installments?customerId=${user.id}`),
        api.get('/settings')
      ]);
      // Precisamos da flag is_loyal do cliente, então vamos buscar o cliente também
      const custRes = await api.get(`/customers/${user.id}`);
      
      const installmentsWithCustomer = instRes.data.map((i: any) => ({...i, customer: custRes.data}));
      setInstallments(installmentsWithCustomer);
      setSettings(settRes.data);
    } catch (err) {
      console.error('Falha ao carregar parcelas', err);
    } finally {
      setLoading(false);
    }
  };

  const getInstallmentTotals = (inst: any) => {
    let calcDiscount = 0;
    let calcPenalty = 0;
    let calcInterest = 0;

    const todayNum = new Date().setHours(0,0,0,0);
    const dueNum = new Date(inst.due_date).setHours(0,0,0,0);

    if (settings?.penalty_active && todayNum > dueNum) {
      const daysLate = Math.floor((todayNum - dueNum) / (1000 * 60 * 60 * 24));
      const monthsLate = daysLate / 30;
      calcPenalty = inst.amount * ((settings.penalty_percent || 0) / 100);
      calcInterest = inst.amount * ((settings.interest_percent || 0) / 100) * monthsLate;
    }

    const punctualityGraceDays = settings?.punctuality_discount_days || 0;
    const punctualityLimitDate = new Date(dueNum);
    punctualityLimitDate.setDate(punctualityLimitDate.getDate() + punctualityGraceDays);
    const punctualityLimitNum = punctualityLimitDate.setHours(0,0,0,0);

    if (todayNum <= punctualityLimitNum) {
      calcDiscount += (inst.punctuality_discount_value || 0);
    }

    calcDiscount += (inst.loyalty_discount_value || 0);

    if (calcDiscount > inst.amount) calcDiscount = inst.amount;

    const finalExpected = inst.amount + calcPenalty + calcInterest - calcDiscount;
    return { calcDiscount, calcPenalty, calcInterest, finalExpected };
  };

  const openPaymentModal = (inst: any) => {
    setPayingInst(inst);
    
    const totals = getInstallmentTotals(inst);

    setDiscountAmount(totals.calcDiscount);
    setPenaltyAmount(totals.calcPenalty);
    setInterestAmount(totals.calcInterest);
    setPaymentAmount(totals.finalExpected);
    setSplitPayments({});
    
    const d = new Date(inst.due_date);
    d.setMonth(d.getMonth() + 1);
    setNextDueDate(d.toISOString().split('T')[0]);
  };

  const handlePay = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!payingInst) return;

    let totalSplit = 0;
    Object.values(splitPayments).forEach(v => totalSplit += v);
    if (Object.keys(splitPayments).length > 0 && Math.abs(totalSplit - paymentAmount) > 0.05) {
      alert(`A soma dos métodos de pagamento (R$ ${totalSplit.toLocaleString('pt-BR')}) deve ser igual ao valor a pagar (R$ ${paymentAmount.toLocaleString('pt-BR')}).`);
      return;
    }

    try {
      const remainingAmount = payingInst.amount + penaltyAmount + interestAmount - discountAmount - paymentAmount;
      


      if (remainingAmount > 0.05) {
        // Atualiza a original para o valor pago e status pago
        await api.put(`/installments/${payingInst.id}`, { status: 'paid', amount: paymentAmount + discountAmount - penaltyAmount - interestAmount });
        // Cria a restante
        await api.post('/installments', {
          saleId: payingInst.saleId,
          customerId: payingInst.customerId,
          amount: remainingAmount,
          due_date: nextDueDate ? new Date(nextDueDate).toISOString() : payingInst.due_date,
          status: 'pending',
          number: payingInst.number,
          total: payingInst.total,
          productName: payingInst.productName
        });
      } else {
        await api.put(`/installments/${payingInst.id}`, { status: 'paid' });
      }

      alert('Pagamento confirmado com sucesso!');
      setPayingInst(null);
      loadInstallments();
    } catch (error) {
      console.error('Erro ao simular pagamento', error);
      alert('Erro ao processar pagamento. Tente novamente.');
    }
  };

  if (loading) {
    return <div className="store-container" style={{ textAlign: 'center', padding: '4rem' }}>Carregando suas faturas...</div>;
  }

  const pending = installments
    .filter(i => i.status === 'pending')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    
  const paid = installments
    .filter(i => i.status === 'paid')
    .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()); // Pagas ordeno as mais recentes primeiro

  return (
    <div className="store-container" style={{ paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link to="/loja" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={20} />
        </Link>
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Minhas Faturas</h2>
      </div>

      <div style={{ display: 'grid', gap: '2rem' }}>
        {/* Faturas Pendentes */}
        <section>
          <h3 style={{ color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={20} color="var(--warning)" /> Pendentes a Pagar
          </h3>
          
          {pending.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhuma fatura em aberto.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pending.map(inst => {
                const totals = getInstallmentTotals(inst);
                return (
                <div key={inst.id} className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>Pedido #{inst.saleId} - Parcela {inst.number}/{inst.total}</h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Vencimento: {new Date(inst.due_date).toLocaleDateString('pt-BR')}</p>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Valor {totals.calcDiscount > 0 ? '(c/ Desconto)' : ''}</span>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--warning)' }}>R$ {totals.finalExpected.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link 
                        to="/loja/pedidos" 
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.8rem 1rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem' }}
                      >
                        <Package size={18} /> Ver Pedido
                      </Link>
                      
                      <button 
                        className="btn-primary" 
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        onClick={() => openPaymentModal(inst)}
                      >
                        <span style={{ fontWeight: 'bold' }}>$</span> Pagar
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Faturas Pagas */}
        {paid.length > 0 && (
          <section>
            <h3 style={{ color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={20} color="var(--success)" /> Histórico (Pagas)
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {paid.map(inst => (
                <div key={inst.id} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', opacity: 0.8 }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>Pedido #{inst.saleId} - Parcela {inst.number}/{inst.total}</h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Vencimento original: {new Date(inst.due_date).toLocaleDateString('pt-BR')}</p>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 'bold', display: 'block' }}>Pago</span>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>R$ {inst.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                    </div>
                    <Link 
                      to="/loja/pedidos" 
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.5rem 1rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem' }}
                    >
                      <Package size={16} /> Ver Pedido
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Modal Pagamento */}
      {payingInst && (
        <div className="modal-overlay" onClick={() => setPayingInst(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--text-main)', margin: 0 }}>Baixar Parcela</h2>
              <button className="btn-icon" onClick={() => setPayingInst(null)}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handlePay}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Original da Parcela {payingInst.number}/{payingInst.total}</p>
                <h3 style={{ fontSize: '2.5rem', margin: '0.5rem 0', color: 'var(--success)' }}>
                   R$ {payingInst.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </h3>
              </div>

              {(penaltyAmount > 0 || interestAmount > 0) && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }}>
                  <p style={{ margin: 0, color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 'bold' }}>Atraso Detectado</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    <span>Multa:</span>
                    <span>R$ {penaltyAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>Juros:</span>
                    <span>R$ {interestAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Descontos Aplicados (R$) {discountAmount > 0 && <strong>(Automático)</strong>}
                </label>
                <input 
                  type="text" 
                  value={maskCurrency(discountAmount)} 
                  disabled
                  style={{ fontSize: '1.2rem', padding: '0.8rem', width: '100%', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: discountAmount > 0 ? 'var(--success)' : 'var(--text-muted)', border: discountAmount > 0 ? '1px solid var(--success)' : '1px solid var(--border-color)', cursor: 'not-allowed' }}
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>*Somente leitura para cliente (Fidelidade/Pontualidade)</p>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label style={{ marginBottom: '0.5rem', display: 'block', fontSize: '1.2rem', fontWeight: 'bold' }}>Valor a Pagar (R$)</label>
                <input 
                  type="text" 
                  required 
                  value={maskCurrency(paymentAmount)} 
                  onChange={e => {
                    let val = parseCurrency(e.target.value) as number;
                    const finalExpected = payingInst.amount + penaltyAmount + interestAmount - discountAmount;
                    if (val > finalExpected) val = finalExpected;
                    setPaymentAmount(val);
                  }} 
                  style={{ fontSize: '1.8rem', fontWeight: 800, padding: '1rem', width: '100%', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.05)', color: 'var(--primary)', border: '2px solid var(--primary)' }}
                />
                {paymentAmount < (payingInst.amount + penaltyAmount + interestAmount - discountAmount) && paymentAmount > 0 && (
                  <p style={{ color: 'var(--warning)', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    Pagamento parcial! Restarão <strong>R$ {((payingInst.amount + penaltyAmount + interestAmount - discountAmount) - paymentAmount).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong> pendentes.
                  </p>
                )}
              </div>

              {paymentAmount < (payingInst.amount + penaltyAmount + interestAmount - discountAmount) && paymentAmount > 0 && (
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label style={{ color: 'var(--warning)', display: 'block' }}>
                    Reagendar restante (Vencimento Atual: {new Date(payingInst.due_date).toLocaleDateString('pt-BR')})
                  </label>
                  <input 
                    type="date" 
                    required 
                    value={nextDueDate}
                    onChange={e => setNextDueDate(e.target.value)}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: 'var(--text-main)', marginTop: '0.5rem' }}
                  />
                </div>
              )}

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label style={{ marginBottom: '0.8rem', display: 'block' }}>Métodos de Pagamento</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {[
                    { id: 'pix', label: 'PIX' },
                    { id: 'cartao_debito', label: 'Cartão Débito' }
                  ].map(opt => {
                    const isChecked = splitPayments[opt.id] !== undefined;
                    return (
                      <div key={opt.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px', padding: '10px', background: isChecked ? 'rgba(99, 102, 241, 0.1)' : 'transparent', borderRadius: '8px', border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)', minWidth: '140px', flex: '1 1 auto' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.9rem', width: '100%' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => {
                              setSplitPayments(prev => {
                                const next = { ...prev };
                                if (next[opt.id] !== undefined) {
                                  delete next[opt.id];
                                } else {
                                  next[opt.id] = 0;
                                }
                                return next;
                              });
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: isChecked ? 600 : 400 }}>{opt.label}</span>
                        </label>
                        {isChecked && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '100%', marginTop: '5px' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>R$</span>
                            <input 
                              type="text"
                              value={splitPayments[opt.id].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              onChange={e => {
                                const numericValue = parseCurrency(e.target.value);
                                setSplitPayments(prev => ({
                                  ...prev,
                                  [opt.id]: numericValue
                                }));
                              }}
                              style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, padding: '1rem' }} onClick={() => setPayingInst(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={20} /> Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
