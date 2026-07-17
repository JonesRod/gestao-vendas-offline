import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, CheckSquare, Square, CheckCircle } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

type PaymentMethodType = 'pix' | 'credit_card' | 'debit_card' | 'money' | 'store_credit';

export default function StoreCart() {
  const { cart, removeFromCart, updateQuantity, updateInstallments, clearCart, cartTotalCash, cartTotalCredit } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [payments, setPayments] = useState<Record<PaymentMethodType, { selected: boolean, amount: number }>>({
    pix: { selected: false, amount: 0 },
    credit_card: { selected: false, amount: 0 },
    debit_card: { selected: false, amount: 0 },
    money: { selected: false, amount: 0 },
    store_credit: { selected: false, amount: 0 }
  });

  const [creditDueDate, setCreditDueDate] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successData, setSuccessData] = useState<string[]>([]);

  const hasActiveCredit = user && user.credit_limit > 0 && !user.is_blocked;
  const isCreditMode = payments.store_credit.selected;
  const currentTotal = isCreditMode ? cartTotalCredit : cartTotalCash;

  useEffect(() => {
    setPayments(prev => {
      const selectedKeys = Object.keys(prev).filter(k => prev[k as PaymentMethodType].selected) as PaymentMethodType[];
      if (selectedKeys.length === 0) return prev;
      
      if (selectedKeys.length === 1) {
        return {
          ...prev,
          [selectedKeys[0]]: { ...prev[selectedKeys[0]], amount: currentTotal }
        };
      } else {
        const target = prev.store_credit.selected ? 'store_credit' : selectedKeys[0];
        const sumOthers = selectedKeys
          .filter(k => k !== target)
          .reduce((sum, k) => sum + prev[k as PaymentMethodType].amount, 0);
          
        return {
          ...prev,
          [target]: { ...prev[target as PaymentMethodType], amount: Math.max(0, currentTotal - sumOthers) }
        };
      }
    });
  }, [currentTotal]);

  const togglePayment = (method: PaymentMethodType) => {
    setPayments(prev => {
      const isSelected = prev[method].selected;
      const selectedKeys = Object.keys(prev).filter(k => prev[k as PaymentMethodType].selected);
      
      // Prevent selecting more than 3 methods
      if (!isSelected && selectedKeys.length >= 3) {
        alert('Você pode selecionar no máximo 3 formas de pagamento simultâneas.');
        return prev;
      }

      const next = { ...prev, [method]: { ...prev[method], selected: !isSelected, amount: 0 } };
      
      if (isSelected) {
        // Toggling OFF -> already set to 0
      } else {
        // Toggling ON -> calculate remaining and auto-fill
        const currentSum = Object.keys(prev)
          .filter(k => prev[k as PaymentMethodType].selected)
          .reduce((sum, k) => sum + prev[k as PaymentMethodType].amount, 0);
        
        const newTotal = method === 'store_credit' ? cartTotalCredit : (prev.store_credit.selected ? cartTotalCredit : cartTotalCash);
        next[method].amount = Math.max(0, newTotal - currentSum);
      }

      if (next.store_credit.selected && method !== 'store_credit') {
        const sumOthers = Object.keys(next)
          .filter(k => k !== 'store_credit' && next[k as PaymentMethodType].selected)
          .reduce((sum, k) => sum + next[k as PaymentMethodType].amount, 0);
        next.store_credit.amount = Math.max(0, cartTotalCredit - sumOthers);
      }

      return next;
    });
  };

  const updatePaymentAmount = (method: PaymentMethodType, amount: number) => {
    setPayments(prev => {
      const next = { ...prev, [method]: { ...prev[method], amount } };
      
      if (next.store_credit.selected && method !== 'store_credit') {
        const sumOthers = Object.keys(next)
          .filter(k => k !== 'store_credit' && next[k as PaymentMethodType].selected)
          .reduce((sum, k) => sum + next[k as PaymentMethodType].amount, 0);
        next.store_credit.amount = Math.max(0, cartTotalCredit - sumOthers);
      }
      
      return next;
    });
  };

  const handleCurrencyChange = (method: PaymentMethodType, textValue: string) => {
    const digits = textValue.replace(/\D/g, '');
    if (!digits) {
      updatePaymentAmount(method, 0);
      return;
    }
    const numericValue = parseInt(digits, 10) / 100;
    updatePaymentAmount(method, numericValue);
  };

  const simulatedInstallments = useMemo(() => {
    if (!payments.store_credit.selected || payments.store_credit.amount <= 0) return [];
    
    const installmentsMap = new Map<number, number>(); 
    cart.forEach(item => {
        const isPromo = item.product.is_promotional;
        const creditPrice = isPromo && item.product.promo_price_credit ? item.product.promo_price_credit : item.product.price_credit;
        const cashPrice = isPromo && item.product.promo_price_cash ? item.product.promo_price_cash : item.product.price_cash;
        const price = item.product.credit_type === 'interest' ? cashPrice : creditPrice;
        const itemInstallments = item.installments || 1;
        const baseTotal = price * item.quantity;
        let itemInterest = 0;
        if (item.product.credit_type === 'interest') {
            itemInterest = baseTotal * ((item.product.credit_interest_rate || 0) / 100) * itemInstallments;
        }
        const totalItem = baseTotal + itemInterest;
        const valuePerInstallment = totalItem / itemInstallments;
        
        for (let i = 0; i < itemInstallments; i++) {
            installmentsMap.set(i, (installmentsMap.get(i) || 0) + valuePerInstallment);
        }
    });

    const totalCrediarioCarrinho = cartTotalCredit;
    const razao = totalCrediarioCarrinho > 0 ? (payments.store_credit.amount / totalCrediarioCarrinho) : 1;
    
    const finalInstallments: { number: number, amount: number }[] = [];
    let acumulado = 0;
    
    installmentsMap.forEach((valorMes, mesOffset) => {
        const finalValue = valorMes * razao;
        if (finalValue > 0) {
            finalInstallments.push({
                number: mesOffset + 1,
                amount: finalValue,
            });
            acumulado += finalValue;
        }
    });

    if (finalInstallments.length > 0) {
        const diff = payments.store_credit.amount - acumulado;
        finalInstallments[finalInstallments.length - 1].amount += diff;
    }
    
    return finalInstallments;
  }, [cart, payments.store_credit.selected, payments.store_credit.amount, cartTotalCredit]);

  const handleCheckout = async () => {
    const selectedKeys = Object.keys(payments).filter(k => payments[k as PaymentMethodType].selected) as PaymentMethodType[];
    
    if (selectedKeys.length === 0) {
      alert('Selecione pelo menos uma forma de pagamento.');
      return;
    }

    if (payments.store_credit.selected && !creditDueDate) {
      alert('Para o crediário, você deve selecionar a data de vencimento.');
      return;
    }

    let sum = 0;
    selectedKeys.forEach(k => sum += payments[k].amount);
    
    // Allow small floating point margin
    if (Math.abs(sum - currentTotal) > 0.05) {
      alert(`A soma dos pagamentos (R$ ${sum.toFixed(2)}) não bate com o total do pedido (R$ ${currentTotal.toFixed(2)}).`);
      return;
    }

    try {
      const items = cart.map(item => {
        const isPromo = item.product.is_promotional;
        let price = isCreditMode 
          ? (isPromo && item.product.promo_price_credit ? item.product.promo_price_credit : item.product.price_credit)
          : (isPromo && item.product.promo_price_cash ? item.product.promo_price_cash : item.product.price_cash);
          
        if (isCreditMode && item.product.credit_type === 'interest') {
          const baseCashPrice = isPromo && item.product.promo_price_cash ? item.product.promo_price_cash : item.product.price_cash;
          const itemInstallments = item.installments || 1;
          const interest = baseCashPrice * ((item.product.credit_interest_rate || 0) / 100) * itemInstallments;
          price = baseCashPrice + interest;
        }
        
        return {
          productId: item.product.id,
          quantity: item.quantity,
          price_applied: price
        };
      });

      // Construct payment method string
      const methodNames: Record<string, string> = {
        pix: 'PIX',
        credit_card: 'Cartão de Crédito',
        debit_card: 'Cartão de Débito',
        money: 'Dinheiro',
        store_credit: 'Crediário'
      };
      const paymentStrings = selectedKeys.map(k => `${methodNames[k]}: R$${payments[k].amount.toFixed(2)}`);
      
      const payload: any = {
        customerId: user?.id,
        totalAmount: currentTotal,
        paymentMethod: paymentStrings.join(' | ') + (payments.store_credit.selected ? ' | credit' : ''),
        status: 'pending',
        date: new Date().toISOString(),
        items
      };

      if (payments.store_credit.selected) {
        // Agrupar parcelas por mês
        const installmentsMap = new Map<number, number>(); // mês -> valor
        
        cart.forEach(item => {
           const isPromo = item.product.is_promotional;
           const creditPrice = isPromo && item.product.promo_price_credit ? item.product.promo_price_credit : item.product.price_credit;
           const cashPrice = isPromo && item.product.promo_price_cash ? item.product.promo_price_cash : item.product.price_cash;
           const price = item.product.credit_type === 'interest' ? cashPrice : creditPrice;
           const itemInstallments = item.installments || 1;
           const baseTotal = price * item.quantity;
           let itemInterest = 0;
           if (item.product.credit_type === 'interest') {
              itemInterest = baseTotal * ((item.product.credit_interest_rate || 0) / 100) * itemInstallments;
           }
           const totalItem = baseTotal + itemInterest;
           const valuePerInstallment = totalItem / itemInstallments;
           
           for (let i = 0; i < itemInstallments; i++) {
              installmentsMap.set(i, (installmentsMap.get(i) || 0) + valuePerInstallment);
           }
        });

        // O valor base é o payments.store_credit.amount.
        // Como o cliente pode ter misturado pagamentos, nós pegamos o 'store_credit.amount'
        // e dividimos proporcionalmente ao peso do mês? Não! Se ele misturou, fica complexo.
        // Vamos apenas usar os valores reais do carrinho se ele pagou tudo no crediário.
        // Se pagou parte em PIX, nós subtraímos essa "entrada" da primeira parcela ou de todas?
        // Assumiremos que a entrada abate da primeira parcela, depois divide.
        // Para simplificar: recalcular tudo com base no store_credit.amount dividido pelos pesos.
        
        const totalCrediarioCarrinho = cartTotalCredit;
        const razao = payments.store_credit.amount / totalCrediarioCarrinho; // Ex: pagou 50% no crediário

        let cartTotalPunctuality = 0;
        let cartTotalLoyalty = 0;

        cart.forEach(item => {
           if (item.product.punctuality_discount_active) {
             cartTotalPunctuality += (item.product.punctuality_discount_value || 0) * item.quantity;
           }
           if (item.product.loyalty_discount_active) {
             cartTotalLoyalty += (item.product.loyalty_discount_value || 0) * item.quantity;
           }
        });

        const punctualityPerInstallment = (cartTotalPunctuality * razao) / installmentsMap.size;
        const loyaltyPerInstallment = (cartTotalLoyalty * razao) / installmentsMap.size;

        const finalInstallments: any[] = [];
        let acumulado = 0;
        
        const baseDate = new Date(creditDueDate);
        
        installmentsMap.forEach((valorMes, mesOffset) => {
           const finalValue = valorMes * razao;
           if (finalValue > 0) {
              const dateMes = new Date(baseDate);
              dateMes.setMonth(dateMes.getMonth() + mesOffset);
              
              finalInstallments.push({
                 customerId: user?.id,
                 amount: finalValue,
                 due_date: dateMes.toISOString(),
                 status: 'pending',
                 number: mesOffset + 1,
                 total: installmentsMap.size,
                 productName: cart.length === 1 ? cart[0].product.name : 'Vários Produtos',
                 punctuality_discount_value: punctualityPerInstallment,
                 loyalty_discount_value: loyaltyPerInstallment
              });
              acumulado += finalValue;
           }
        });

        // Corrigir centavos da última parcela
        if (finalInstallments.length > 0) {
           const diff = payments.store_credit.amount - acumulado;
           finalInstallments[finalInstallments.length - 1].amount += diff;
        }

        payload.installments = finalInstallments;
        payload.due_date = baseDate.toISOString();
      }

      await api.post('/sales', payload);
      
      setSuccessData(paymentStrings);
      setShowSuccessModal(true);
      clearCart();
    } catch (err) {
      console.error(err);
      alert('Erro ao finalizar o pedido. Tente novamente.');
    }
  };

  if (cart.length === 0) {
    return (
      <div className="store-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div style={{ background: 'var(--bg-panel)', padding: '3rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'inline-block', width: '100%', maxWidth: '500px' }}>
          <ShoppingCart size={64} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
          <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Seu carrinho está vazio</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Você ainda não adicionou nenhum produto ao seu carrinho.</p>
          <Link to="/loja" className="btn-primary" style={{ display: 'inline-block', padding: '0.8rem 2rem', textDecoration: 'none' }}>
            Continuar Comprando
          </Link>
        </div>
      </div>
    );
  }

  const selectedMethods = Object.keys(payments).filter(k => payments[k as PaymentMethodType].selected) as PaymentMethodType[];
  const sumAmounts = selectedMethods.reduce((sum, k) => sum + payments[k].amount, 0);
  const remaining = currentTotal - sumAmounts;

  return (
    <div className="store-container" style={{ paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link to="/loja" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={20} />
        </Link>
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Meu Carrinho</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {cart.map((item) => {
              const product = item.product;
              const isPromo = product.is_promotional;
              let displayPrice = isCreditMode 
              ? (isPromo && product.promo_price_credit ? product.promo_price_credit : product.price_credit)
              : (isPromo && product.promo_price_cash ? product.promo_price_cash : product.price_cash);
              
            if (isCreditMode && product.credit_type === 'interest') {
              const baseCashPrice = isPromo && product.promo_price_cash ? product.promo_price_cash : product.price_cash;
              const itemInstallments = item.installments || 1;
              const interest = baseCashPrice * ((product.credit_interest_rate || 0) / 100) * itemInstallments;
              displayPrice = baseCashPrice + interest;
            }
            
            const mainImage = product.images && product.images.length > 0 ? product.images[0] : null;

              return (
                <div key={product.id} style={{ display: 'flex', gap: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '8px', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {mainImage ? (
                      <img src={mainImage} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <ShoppingCart size={32} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                    )}
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>{product.name}</h3>
                      <button 
                        onClick={() => removeFromCart(product.id as number)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.2rem' }}
                        title="Remover"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 'bold', color: isCreditMode ? 'var(--warning)' : 'var(--success)', fontSize: '1.1rem' }}>
                          R$ {displayPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          {isCreditMode && <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem', fontWeight: 'normal' }}>(A Prazo)</span>}
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', borderRadius: '8px', padding: '0.3rem', border: '1px solid var(--border-color)' }}>
                          <button 
                            onClick={() => updateQuantity(product.id as number, item.quantity - 1)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Minus size={16} />
                          </button>
                          <span style={{ width: '40px', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-main)' }}>
                            {item.quantity}
                          </span>
                          <button 
                            onClick={() => updateQuantity(product.id as number, item.quantity + 1)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                      
                      {isCreditMode && product.allow_credit !== false && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', alignSelf: 'flex-start', maxWidth: '100%', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Parcelamento:</span>
                          <select 
                            value={item.installments || 1} 
                            onChange={(e) => updateInstallments(product.id as number, Number(e.target.value))}
                            style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontWeight: 500, maxWidth: '100%', textOverflow: 'ellipsis' }}
                          >
                            {Array.from({ length: product.max_installments || 1 }, (_, i) => i + 1).map(n => {
                              const baseCreditPrice = product.is_promotional && product.promo_price_credit ? product.promo_price_credit : product.price_credit;
                              const baseCashPrice = product.is_promotional && product.promo_price_cash ? product.promo_price_cash : product.price_cash;
                              const basePrice = product.credit_type === 'interest' ? baseCashPrice : baseCreditPrice;
                              let instValue = basePrice / n;
                              if (product.credit_type === 'interest') {
                                const interest = basePrice * ((product.credit_interest_rate || 0) / 100) * n;
                                instValue = (basePrice + interest) / n;
                              }
                              return (
                                <option key={n} value={n} style={{ background: 'var(--bg-panel)' }}>
                                  {n}x de R$ {instValue.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} {product.credit_type === 'interest' ? '(com juros)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem' }}>
            <button 
              onClick={clearCart}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
            >
              Esvaziar Carrinho
            </button>
          </div>
        </div>

        {/* FORMA DE PAGAMENTO */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)' }}>Forma de Pagamento</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Selecione até 3 formas de pagamento para dividir o valor.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { id: 'pix', label: 'PIX' },
              { id: 'credit_card', label: 'Cartão de Crédito' },
              { id: 'debit_card', label: 'Cartão de Débito' },
              { id: 'money', label: 'Dinheiro' },
            ].map(method => (
              <div key={method.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div 
                  onClick={() => togglePayment(method.id as PaymentMethodType)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', minWidth: '160px' }}
                >
                  {payments[method.id as PaymentMethodType].selected ? <CheckSquare size={20} color="var(--primary)" /> : <Square size={20} color="var(--text-muted)" />}
                  <span>{method.label}</span>
                </div>
                {payments[method.id as PaymentMethodType].selected && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>R$</span>
                    <input 
                      type="text"
                      value={payments[method.id as PaymentMethodType].amount ? payments[method.id as PaymentMethodType].amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''}
                      onChange={e => handleCurrencyChange(method.id as PaymentMethodType, e.target.value)}
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', width: '120px' }}
                      placeholder="0,00"
                    />
                  </div>
                )}
              </div>
            ))}

            {hasActiveCredit && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div 
                    onClick={() => togglePayment('store_credit')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', minWidth: '160px' }}
                  >
                    {payments.store_credit.selected ? <CheckSquare size={20} color="var(--success)" /> : <Square size={20} color="var(--text-muted)" />}
                    <span style={{ fontWeight: 'bold' }}>Crediário (A Prazo)</span>
                  </div>
                  {payments.store_credit.selected && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', paddingLeft: '0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', minWidth: '130px' }}>Vencimento Inicial:</span>
                          <input 
                            type="date" 
                            min={new Date().toISOString().split('T')[0]}
                            value={creditDueDate}
                            onChange={(e) => setCreditDueDate(e.target.value)}
                            style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', minWidth: '130px' }}
                          />
                        </div>
                        
                        {simulatedInstallments.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {simulatedInstallments.map((inst, index) => {
                              // Adiciona UTC no final para evitar problemas de fuso horário ao instanciar a data do input
                              const dateParts = creditDueDate.split('-');
                              const instDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
                              instDate.setMonth(instDate.getMonth() + index);
                              return (
                                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'var(--bg-panel)', borderRadius: '4px', border: '1px solid var(--border-color)', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 500 }}>
                                      Parcela {index + 1}/{simulatedInstallments.length}
                                    </span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                      Venc: {instDate.toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>
                                  <span style={{ fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', fontSize: '0.95rem' }}>
                                    R$ {inst.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-main)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <span style={{ color: 'var(--text-secondary)' }}>Falta preencher:</span>
             <span style={{ color: Math.abs(remaining) < 0.05 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
               R$ {remaining.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
             </span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-main)' }}>Resumo do Pedido</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Subtotal ({cart.length} itens)</span>
              <span>R$ {currentTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Tabela de Preços</span>
              <span style={{ color: isCreditMode ? 'var(--warning)' : 'var(--success)' }}>
                {isCreditMode ? 'A Prazo' : 'À Vista'}
              </span>
            </div>

            {selectedMethods.length > 0 && (
              <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Composição do Pagamento:</span>
                {selectedMethods.map(method => {
                  const methodLabels: Record<string, string> = {
                    pix: 'PIX', credit_card: 'Cartão de Crédito', debit_card: 'Cartão de Débito', money: 'Dinheiro', store_credit: 'Crediário'
                  };
                  return (
                    <div key={method} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      <span>{methodLabels[method]}</span>
                      <span>R$ {payments[method].amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontWeight: 'bold', fontSize: '1.2rem' }}>
              <span>Total Estimado</span>
              <span>R$ {currentTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
          </div>
          
          <button 
            onClick={() => setShowConfirmModal(true)}
            className="btn-primary" 
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '8px', opacity: Math.abs(remaining) > 0.05 ? 0.5 : 1 }}
            disabled={Math.abs(remaining) > 0.05}
          >
            Finalizar Pedido
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowConfirmModal(false)}>
          <div className="glass-panel" onClick={e => e.stopPropagation()} style={{ padding: '2rem', borderRadius: '12px', maxWidth: '400px', width: '90%', textAlign: 'center', background: 'var(--bg-panel)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>Confirmar Pedido</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Deseja finalizar o pedido no valor de <strong style={{ color: 'var(--warning)' }}>R$ {currentTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setShowConfirmModal(false)}
                style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setShowConfirmModal(false);
                  handleCheckout();
                }}
                className="btn-primary" 
                style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '12px', maxWidth: '400px', width: '90%', textAlign: 'center', background: 'var(--bg-panel)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
             <CheckCircle size={64} color="var(--success)" style={{ margin: '0 auto 1rem' }} />
             <h2 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '1.5rem' }}>Pedido Finalizado!</h2>
             <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Seu pedido foi processado com sucesso.</p>
             
             <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'left', border: '1px solid var(--border-color)' }}>
               <h4 style={{ margin: '0 0 0.8rem 0', color: 'var(--text-main)', fontSize: '0.95rem' }}>Resumo do Pagamento</h4>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 {successData.map(str => {
                   const [method, amount] = str.split(': ');
                   return (
                     <div key={str} style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between' }}>
                       <span>{method}</span>
                       <strong style={{ color: 'var(--text-main)' }}>{amount}</strong>
                     </div>
                   );
                 })}
               </div>
             </div>
             
             <button 
               className="btn-primary" 
               style={{ width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: 'bold' }}
               onClick={() => {
                 setShowSuccessModal(false);
                 navigate('/loja/pedidos');
               }}
             >
               Ver Meus Pedidos
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
