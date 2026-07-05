import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, DollarSign, Wallet, CheckCircle, ChevronLeft, Calendar, FileText, Info, Printer, Share2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Customer, type Installment, type Sale } from '../db/db';
import { api } from '../services/api';
import Modal from '../components/Modal';
import { maskCurrency, parseCurrency } from '../utils/masks';
import './Receipts.css';

export default function Receipts() {
  const [searchTerm, setSearchTerm] = useState('');
  const location = useLocation();
  const [step, setStep] = useState<'search' | 'account'>('search');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInstallments, setCustomerInstallments] = useState<Installment[]>([]);
  
  // Detalhes da parcela
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [installmentSale, setInstallmentSale] = useState<Sale | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Pagamento da parcela
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [autoDiscount, setAutoDiscount] = useState<number>(0);
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [nextDueDate, setNextDueDate] = useState('');
  const [showConfirmPayment, setShowConfirmPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Record<string, number>>({ dinheiro: 0 });
  const [showSuccess, setShowSuccess] = useState(false);
  
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pendingInstallments, setPendingInstallments] = useState<Installment[]>([]);

  const loadInitialData = async () => {
    try {
      const [custRes, instRes] = await Promise.all([
        api.get('/customers'),
        api.get('/installments?status=pending')
      ]);
      setCustomers(custRes.data);
      setPendingInstallments(instRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (location.state?.customerId && customers.length > 0) {
      const c = customers.find(x => x.id === location.state.customerId);
      if (c && (!selectedCustomer || selectedCustomer.id !== c.id)) {
        handleSelectCustomer(c);
      }
    }
  }, [location.state, customers]);

  const debtors = customers.filter(c => c.credit_used > 0);
  
  const attentionCustomerIds = new Set(
    pendingInstallments.filter(inst => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const nextDays = new Date(today);
      nextDays.setDate(today.getDate() + 5); 
      return new Date(inst.due_date) <= nextDays;
    }).map(inst => inst.customerId)
  );

  const attentionDebtors = debtors.filter(c => c.id && attentionCustomerIds.has(c.id));

  // Não mostrar clientes de início (só se pesquisar)
  const filteredCustomers = searchTerm.trim().length >= 2 ? customers.filter((c: Customer) => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  ) : [];

  const totalDebt = debtors.reduce((sum, c) => sum + c.credit_used, 0);

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    await loadCustomerInstallments(customer.id!);
    setStep('account');
  };

  const loadCustomerInstallments = async (customerId: number) => {
    try {
      const res = await api.get(`/installments?customerId=${customerId}&status=pending`);
      const installs = res.data;
      installs.sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      setCustomerInstallments(installs);
    } catch (err) {
      console.error(err);
    }
  };

  const openDetails = async (installment: Installment) => {
    setSelectedInstallment(installment);
    try {
      const res = await api.get('/sales');
      const sale = res.data.find((s: any) => s.id === installment.saleId);
      setInstallmentSale(sale || null);
    } catch (e) {
      console.error(e);
    }
    setIsDetailsModalOpen(true);
  };

  const openPayment = (installment: Installment) => {
    setSelectedInstallment(installment);
    
    let calcAutoDiscount = 0;
    let calcPenalty = 0;
    let calcInterest = 0;

    const todayNum = new Date().setHours(0,0,0,0);
    const dueNum = new Date(installment.due_date).setHours(0,0,0,0);

    // Multas e Juros
    if (settings?.penalty_active && todayNum > dueNum) {
      const daysLate = Math.floor((todayNum - dueNum) / (1000 * 60 * 60 * 24));
      const monthsLate = daysLate / 30;
      calcPenalty = installment.amount * ((settings.penalty_percent || 0) / 100);
      calcInterest = installment.amount * ((settings.interest_percent || 0) / 100) * monthsLate;
    }

    // Desconto Pontualidade
    const punctualityGraceDays = settings?.punctuality_discount_days || 0;
    const punctualityLimitDate = new Date(dueNum);
    punctualityLimitDate.setDate(punctualityLimitDate.getDate() + punctualityGraceDays);
    const punctualityLimitNum = punctualityLimitDate.setHours(0,0,0,0);

    if (settings?.punctuality_discount_active && todayNum <= punctualityLimitNum) {
      calcAutoDiscount += (installment.punctuality_discount_value || 0);
    }

    // Desconto Fidelidade
    if (settings?.loyalty_active && selectedCustomer?.is_loyal) {
      calcAutoDiscount += (installment.loyalty_discount_value || 0);
    }

    if (calcAutoDiscount > installment.amount) calcAutoDiscount = installment.amount;

    setAutoDiscount(calcAutoDiscount);
    setDiscountAmount(calcAutoDiscount);
    setPenaltyAmount(calcPenalty);
    setInterestAmount(calcInterest);

    const finalExpected = installment.amount + calcPenalty + calcInterest - calcAutoDiscount;
    setPaymentAmount(finalExpected);
    setNextDueDate('');
    setSplitPayments({ dinheiro: finalExpected });
    setIsPaymentModalOpen(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedCustomer.id || !selectedInstallment || !selectedInstallment.id) return;
    
    const finalExpected = selectedInstallment.amount + penaltyAmount + interestAmount - discountAmount;

    if (paymentAmount <= 0 && finalExpected > 0) {
      alert('Valor de pagamento inválido.');
      return;
    }

    const methods = Object.keys(splitPayments);
    if (methods.length === 0) {
      alert('Selecione pelo menos um método de pagamento.');
      return;
    }

    const sum = methods.reduce((acc, method) => acc + splitPayments[method], 0);
    if (Math.abs(sum - paymentAmount) > 0.01) {
      alert(`A soma dos pagamentos (R$ ${sum.toFixed(2)}) não bate com o valor informado (R$ ${paymentAmount.toFixed(2)}).`);
      return;
    }

    const isPartial = paymentAmount < finalExpected;

    if (isPartial && !nextDueDate) {
      alert('Para recebimento parcial, informe a data de vencimento do restante.');
      return;
    }

    setShowConfirmPayment(true);
  };

  const executePayment = async () => {
    if (!selectedCustomer || !selectedCustomer.id || !selectedInstallment || !selectedInstallment.id) return;
    const finalExpected = selectedInstallment.amount + penaltyAmount + interestAmount - discountAmount;
    const isPartial = paymentAmount < finalExpected;
    
    try {
      if (!isPartial) {
        // 1. Marca parcela como paga integralmente
        await api.put(`/installments/${selectedInstallment.id}`, { 
          status: 'paid' 
        });
      } else {
        // 1. Recebimento parcial: cria nova parcela com o saldo e abate a atual
        const remainingBase = finalExpected - paymentAmount;
        await api.post('/installments', {
          saleId: selectedInstallment.saleId,
          customerId: selectedCustomer.id,
          amount: remainingBase,
          due_date: new Date(nextDueDate).toISOString(),
          status: 'pending',
          number: selectedInstallment.number,
          total: selectedInstallment.total,
          productName: selectedInstallment.productName + ' (Restante)'
        });
        await api.put(`/installments/${selectedInstallment.id}`, { status: 'paid', amount: paymentAmount + discountAmount - penaltyAmount - interestAmount });
      }

      // 2. Registra o dinheiro físico que entrou
      if (paymentAmount > 0) {
        const methods = Object.keys(splitPayments);
        let finalPaymentMethodStr = '';
        if (methods.length === 1 && splitPayments[methods[0]] === paymentAmount) {
          finalPaymentMethodStr = methods[0];
        } else {
          const splitArr = methods.map(m => ({ method: m, amount: splitPayments[m] })).filter(m => m.amount > 0);
          finalPaymentMethodStr = JSON.stringify(splitArr);
        }

        await api.post('/payments', {
          customerId: selectedCustomer.id,
          amount: paymentAmount,
          method: finalPaymentMethodStr,
          date: new Date()
        });
      }

      // 3. Abate do crédito utilizado. Juros (valor a mais) não abatem a dívida original.
      const interest = Math.max(0, paymentAmount - finalExpected);
      const effectivePayment = paymentAmount - interest;
      const newCreditUsed = selectedCustomer.credit_used - (effectivePayment + discountAmount);
      await api.put(`/customers/${selectedCustomer.id}`, {
        credit_used: Math.max(0, newCreditUsed) 
      });

      setIsPaymentModalOpen(false);
      setShowConfirmPayment(false);
      setShowSuccess(true);
      
      await loadInitialData(); // reload customers and pending installments
      
      // Update selected customer
      const updatedCustRes = await api.get('/customers');
      const updatedCustomer = updatedCustRes.data.find((c: any) => c.id === selectedCustomer.id);
      if (updatedCustomer) setSelectedCustomer(updatedCustomer);
      
      await loadCustomerInstallments(selectedCustomer.id);
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar pagamento da parcela.');
    }
  };

  const shareReceipt = async (inst: any, cust: any, amountPaid: number) => {
    if (!inst || !cust) return;
    const finalExpected = inst.amount - discountAmount;
    const interest = Math.max(0, amountPaid - finalExpected);
    const remaining = Math.max(0, cust.credit_used - (amountPaid - interest) - discountAmount);
    
    let extrasText = '';
    if (discountAmount > 0) extrasText += `\n*Desconto Aplicado:* R$ ${discountAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if (interest > 0) extrasText += `\n*Juros/Multa:* R$ ${interest.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    
    const text = `🧾 *RECIBO DE PAGAMENTO* 🧾
-----------------------------------
*Cliente:* ${cust.name}
*Data do Pagamento:* ${new Date().toLocaleDateString('pt-BR')}
*Valor Pago:* R$ ${amountPaid.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
-----------------------------------
*Cód. da Compra:* #${inst.saleId || 'N/A'}
*Referente a:* Parcela ${inst.number}/${inst.total}
*Produto(s):* ${inst.productName}${extrasText}
-----------------------------------
*Restante a Pagar (Dívida Atual):* R$ ${remaining.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
-----------------------------------
Obrigado pela preferência!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Recibo de Pagamento',
          text: text,
        });
      } catch (error) {
        if ((error as any).name !== 'AbortError') {
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const calculateDelay = (dueDate: Date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(dueDate);
    due.setHours(0,0,0,0);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.4s ease-out'}}>
      
      {step === 'search' && (
        <>
          <div className="page-header">
            <h1 className="page-title">Cobranças e Recebimentos</h1>
          </div>

          <div className="receipts-layout">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="search-box glass-panel" style={{ flex: 'none', padding: '1rem', display: 'flex', alignItems: 'center', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <Search size={20} className="text-muted" style={{ marginRight: '1rem' }} />
                <input 
                  type="text" 
                  placeholder="Pesquisar cliente (digite ao menos 2 letras)..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', flex: 1, fontSize: '1.05rem' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                {searchTerm.trim().length >= 2 ? (
                   filteredCustomers.length === 0 ? (
                    <p style={{color: 'var(--text-muted)'}}>Nenhum cliente encontrado com essa busca.</p>
                   ) : (
                    filteredCustomers.map(customer => (
                      <div key={customer.id} className="debtor-row glass-panel" onClick={() => handleSelectCustomer(customer)}>
                        <div>
                          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{customer.name}</h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{customer.phone}</p>
                        </div>
                        <div className="debtor-total" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                          <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Dívida Total:</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)' }}>R$ {customer.credit_used.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        </div>
                      </div>
                    ))
                   )
                ) : (
                  <>
                    <h3 style={{ fontSize: '1rem', color: 'var(--warning)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                       Em Atraso & Vencendo (Próx. 5 dias)
                    </h3>
                    {attentionDebtors.length === 0 ? (
                      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                        <CheckCircle size={48} style={{ opacity: 0.2, margin: '0 auto 1rem', color: 'var(--success)' }} />
                        <p>Excelente! Nenhuma conta de cliente está em atraso ou vencendo nos próximos 5 dias.</p>
                      </div>
                    ) : (
                      attentionDebtors.map(customer => (
                        <div key={customer.id} className="debtor-row glass-panel" onClick={() => handleSelectCustomer(customer)} style={{ borderLeft: '4px solid var(--danger)' }}>
                          <div>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{customer.name}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{customer.phone}</p>
                          </div>
                          <div className="debtor-total" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                            <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Dívida Total:</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)' }}>R$ {customer.credit_used.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="overview-panel">
              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', background: 'var(--bg-glass)' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wallet size={20} className="text-primary" /> Balanço Geral
                </h2>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '1rem', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total a Receber (Rua)</span>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--warning)', marginTop: '0.5rem' }}>
                    R$ {totalDebt.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 'account' && selectedCustomer && (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <div className="account-header">
            <button className="btn-icon" onClick={() => setStep('search')} style={{ background: 'var(--glass-bg)', padding: '0.75rem' }}>
              <ChevronLeft size={24} />
            </button>
            <div>
              <h2 style={{ fontSize: '1.8rem', margin: 0 }}>{selectedCustomer.name}</h2>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                <p style={{ margin: 0 }}><strong>Contato:</strong> {selectedCustomer.phone}</p>
                <p style={{ margin: 0 }}>
                  <strong>Endereço:</strong> {selectedCustomer.street || (selectedCustomer.address && selectedCustomer.address.street) ? 
                    `${selectedCustomer.street || selectedCustomer.address?.street}, ${selectedCustomer.number || selectedCustomer.address?.number} - ${selectedCustomer.neighborhood || selectedCustomer.address?.neighborhood} | ${selectedCustomer.city || selectedCustomer.address?.city}` 
                    : 'Endereço não cadastrado'}
                </p>
              </div>
            </div>
            <div className="account-header-total">
               <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Saldo Devedor Total</span>
               <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)' }}>R$ {selectedCustomer.credit_used.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
              <button className="btn-secondary" style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }} onClick={() => window.print()} title="Imprimir Relatório do Cliente">
                <Printer size={20} />
              </button>
              <button className="btn-secondary" style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }} onClick={async () => {
                 if (navigator.share) {
                   try { await navigator.share({ title: 'Fatura do Cliente - Gestão Offline', text: `Confira o relatório de pendências de ${selectedCustomer.name}`, url: window.location.href }); } catch (e) {}
                 } else { alert('Compartilhamento não suportado.'); }
              }} title="Compartilhar">
                <Share2 size={20} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {customerInstallments.length === 0 ? (
               <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', borderRadius: '12px' }}>
                  <CheckCircle size={48} className="text-success" style={{ margin: '0 auto 1rem' }} />
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--success)' }}>Tudo em dias!</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Este cliente não possui parcelas pendentes.</p>
               </div>
            ) : (
               customerInstallments.map(inst => {
                 const isDelayed = calculateDelay(inst.due_date) > 0;
                 return (
                  <div key={inst.id} className="installment-card glass-panel" style={{ borderLeft: isDelayed ? '4px solid var(--danger)' : '4px solid var(--primary)' }}>
                    
                    <div className="installment-info">
                      <div>
                        <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem 0' }}>{inst.productName}</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <strong>Cód. Compra:</strong> #{inst.saleId} | <strong>Data:</strong> {inst.sale ? new Date(inst.sale.date).toLocaleDateString() : 'N/A'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: isDelayed ? 'var(--danger)' : 'inherit' }}>
                            <Calendar size={14} /> 
                            Vence: {new Date(inst.due_date).toLocaleDateString()}
                            {isDelayed && <strong style={{ marginLeft: '0.5rem' }}>({calculateDelay(inst.due_date)} dias atraso)</strong>}
                          </span>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center', minWidth: '80px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Parcela</span>
                        <span style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{inst.number}/{inst.total}</span>
                      </div>
                    </div>

                    <div className="installment-actions">
                      <div className="amount-display" style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Valor da Parcela</span>
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>R$ {inst.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                      
                      <div className="installment-actions-btns">
                        <button className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }} title="Detalhes da Fatura" onClick={() => openDetails(inst)}>
                          <Info size={16} /> Det.
                        </button>
                        <button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', background: 'var(--success)' }} title="Receber Título / Dar Baixa" onClick={() => openPayment(inst)}>
                          <DollarSign size={16} /> Rec.
                        </button>
                      </div>
                    </div>

                  </div>
                 )
               })
            )}
          </div>
        </div>
      )}

      {/* MODAL DETALHES */}
      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Detalhes da Fatura" size="default">
        {selectedInstallment && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                <FileText size={20} /> Resumo do Título
              </h3>
              <div className="details-grid">
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Produto / Referência</span>
                  <div style={{ fontWeight: 600 }}>{selectedInstallment.productName}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>N° da Parcela</span>
                  <div style={{ fontWeight: 600 }}>{selectedInstallment.number} de {selectedInstallment.total}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Data da Emissão (Compra)</span>
                  <div style={{ fontWeight: 600 }}>{installmentSale ? new Date(installmentSale.date).toLocaleDateString() : 'Desconhecida'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Data de Vencimento</span>
                  <div style={{ fontWeight: 600 }}>{new Date(selectedInstallment.due_date).toLocaleDateString()}</div>
                </div>
                <div>
                   <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Valor Original da Parcela</span>
                   <div style={{ fontWeight: 600, color: 'white' }}>R$ {selectedInstallment.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                </div>
                <div>
                   <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Atraso Atual</span>
                   <div style={{ fontWeight: 600, color: calculateDelay(selectedInstallment.due_date) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                     {calculateDelay(selectedInstallment.due_date)} dias
                   </div>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Genuíno em Aberto:</span>
                <span>R$ {selectedInstallment.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Acréscimos (Atraso):</span>
                <span style={{ color: 'var(--warning)' }}>R$ { (penaltyAmount + interestAmount).toLocaleString('pt-BR', {minimumFractionDigits: 2}) }</span>
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

              {autoDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Desconto Automático (Fidelidade/Pontualidade):</span>
                  <span style={{ color: 'var(--success)' }}>
                    - R$ {autoDiscount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </span>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Desconto Manual Adicional:</span>
                <input 
                  type="number" 
                  value={discountAmount - autoDiscount < 0 ? 0 : discountAmount - autoDiscount} 
                  onChange={e => {
                    const extraDiscount = Number(e.target.value);
                    setDiscountAmount(autoDiscount + extraDiscount);
                    setPaymentAmount(selectedInstallment.amount + penaltyAmount + interestAmount - autoDiscount - extraDiscount);
                  }}
                  style={{ width: '100px', textAlign: 'right', background: 'var(--bg-lighter)' }}
                />
              </div>

              <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '1rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 800 }}>
                <span>Total a Receber Agora:</span>
                <span>R$ {
                  Math.max(0, selectedInstallment.amount + penaltyAmount + interestAmount - discountAmount).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})
                }</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL PAGAMENTO */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Baixar Parcela">
        <form onSubmit={handlePayment}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Original da Parcela {selectedInstallment?.number}/{selectedInstallment?.total}</p>
            <h3 style={{ fontSize: '2.5rem', margin: '0.5rem 0', color: 'var(--success)' }}>
               R$ {( (selectedInstallment?.amount || 0) + penaltyAmount + interestAmount - discountAmount).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </h3>
            <p style={{ color: 'white' }}>{selectedInstallment?.productName}</p>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label style={{ marginBottom: '0.5rem', display: 'block', color: autoDiscount > 0 ? 'var(--success)' : 'inherit' }}>
              Desconto Concedido (R$) {autoDiscount > 0 && <strong>(Automático de Pontualidade)</strong>}
            </label>
            <input 
              type="text" 
              value={maskCurrency(discountAmount)} 
              onChange={e => {
                let val = parseCurrency(e.target.value) as number;
                setDiscountAmount(val);
                setPaymentAmount(selectedInstallment!.amount + penaltyAmount + interestAmount - val);
              }} 
              style={{ fontSize: '1.2rem', padding: '0.8rem', width: '100%', borderRadius: '8px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
            />
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label style={{ marginBottom: '0.5rem' }}>Valor a Receber (R$)</label>
            <input 
              type="text" 
              required 
              value={maskCurrency(paymentAmount)} 
              onChange={e => {
                let val = parseCurrency(e.target.value) as number;
                const finalExpected = (selectedInstallment?.amount || 0) + penaltyAmount + interestAmount - discountAmount;
                if (val > finalExpected) val = finalExpected;
                setPaymentAmount(val);
              }} 
              style={{ fontSize: '1.5rem', fontWeight: 700, padding: '1rem', width: '100%', borderRadius: '8px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
            />
            {paymentAmount < ((selectedInstallment?.amount || 0) + penaltyAmount + interestAmount - discountAmount) && paymentAmount > 0 && (
              <p style={{ color: 'var(--warning)', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                Recebimento parcial! Ficarão pendentes <strong>R$ {((selectedInstallment!.amount + penaltyAmount + interestAmount - discountAmount) - paymentAmount).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
              </p>
            )}
          </div>

          {paymentAmount < ((selectedInstallment?.amount || 0) + penaltyAmount + interestAmount - discountAmount) && paymentAmount > 0 && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label style={{ color: 'var(--warning)' }}>
                Reagendar restante (Vencimento Atual: {selectedInstallment?.due_date ? new Date(selectedInstallment.due_date).toLocaleDateString('pt-BR') : 'N/A'})
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

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label style={{ marginBottom: '0.8rem' }}>Métodos de Pagamento</label>
            <div className="payment-method-selector-horizontal" style={{ flexWrap: 'wrap' }}>
              {[
                { id: 'dinheiro', label: 'Dinheiro' },
                { id: 'pix', label: 'PIX' },
                { id: 'cartao_debito', label: 'Cartão Débito' },
                { id: 'cartao_credito', label: 'Cartão Crédito' }
              ].map(opt => {
                const isChecked = splitPayments[opt.id] !== undefined;
                return (
                  <div key={opt.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px', padding: '5px 10px', background: isChecked ? 'rgba(99, 102, 241, 0.1)' : 'transparent', borderRadius: '4px', border: isChecked ? '1px solid var(--primary)' : '1px solid transparent' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', margin: 0, fontSize: '0.9rem' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '100%', paddingLeft: '18px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>R$</span>
                        <input 
                          type="text"
                          value={splitPayments[opt.id].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          onChange={e => {
                            const valueStr = e.target.value.replace(/\D/g, '');
                            const numericValue = parseInt(valueStr, 10) / 100;
                            setSplitPayments(prev => ({
                              ...prev,
                              [opt.id]: isNaN(numericValue) ? 0 : numericValue
                            }));
                          }}
                          style={{ width: '100%', maxWidth: '100px', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsPaymentModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--success)' }}><CheckCircle size={18} /> Confirmar</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showConfirmPayment} onClose={() => setShowConfirmPayment(false)} title="Confirmar Recebimento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem 0' }}>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>Confirmar a baixa desta parcela?</p>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <p style={{ margin: '0 0 0.5rem 0' }}><strong style={{ color: 'var(--text-muted)' }}>Valor a Receber:</strong> R$ {paymentAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            <p style={{ margin: '0 0 0.5rem 0' }}><strong style={{ color: 'var(--text-muted)' }}>Métodos:</strong> {Object.keys(splitPayments).join(', ')}</p>
            {selectedCustomer && (
              <p style={{ margin: 0 }}><strong style={{ color: 'var(--text-muted)' }}>Cliente:</strong> {selectedCustomer.name}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowConfirmPayment(false)}>Cancelar</button>
            <button type="button" className="btn-primary" style={{ flex: 1, background: 'var(--success)' }} onClick={executePayment}>Sim, Receber</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showSuccess} onClose={() => setShowSuccess(false)} title="Concluído">
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <CheckCircle size={64} color="var(--success)" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>Recebimento Confirmado!</h2>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn-secondary" style={{ flex: 1, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={() => shareReceipt(selectedInstallment, selectedCustomer, paymentAmount)}>
              <Share2 size={20} /> Compartilhar Recibo
            </button>
            <button className="btn-primary" style={{ flex: 1, padding: '1rem' }} onClick={() => setShowSuccess(false)}>
              Fechar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
