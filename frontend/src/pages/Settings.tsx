import { useState, useEffect } from 'react';
import { Save, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Settings as SettingsType } from '../db/db';
import { api } from '../services/api';
import { maskCNPJ, maskPhone, maskCEP, fetchAddressByCep, maskDate, maskCurrency, parseCurrency } from '../utils/masks';
import './Settings.css';

export default function Settings() {
  const settingsData = useLiveQuery(() => db.settings.get(1));
  const [isSaved, setIsSaved] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    loja: true,
    jornada: true,
    regras: true,
    frete: true,
    mensagens: true,
    pagamentos: true,
  });

  const defaultHours = Array.from({length: 7}).map(() => ({
    isOpen: true,
    openTime: '08:00',
    closeTime: '18:00',
    breakStart: '12:00',
    breakEnd: '13:00'
  }));
  const [parsedHours, setParsedHours] = useState(defaultHours);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const initialFormState: Partial<SettingsType> = {
    email: '', phone: '', tradeName: '', companyName: '', cnpj: '', ownerBirthDate: '',
    address: { cep: '', street: '', number: '', neighborhood: '', city: '', state: '', observation: '' },
    show_address_storefront: true,
    loyalty_active: false, loyalty_days: 30,
    penalty_active: false, penalty_percent: 2, interest_percent: 1,
    whatsapp_provider: 'evolution', whatsapp_url: '', whatsapp_token: '', whatsapp_instance: '', email_token: '', email_sender: '',
    online_payment_active: false, payment_gateway: '', payment_api_key: '', payment_webhook_secret: ''
  };

  const [formData, setFormData] = useState<Partial<SettingsType>>(initialFormState);

  useEffect(() => {
    if (settingsData) {
      setFormData(settingsData);
      if (settingsData.business_hours) {
        try {
          setParsedHours(JSON.parse(settingsData.business_hours));
        } catch (e) {}
      }
    }
  }, [settingsData]);

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
    try {
      const dataToSave = { ...formData, business_hours: JSON.stringify(parsedHours), updated_at: new Date() } as SettingsType;
      
      const count = await db.settings.count();
      if (count === 0) {
        dataToSave.id = 1;
        await db.settings.add(dataToSave);
      } else {
        await db.settings.update(1, dataToSave);
      }

      try {
        const { address, id, ...rest } = dataToSave;
        let apiPayload = { ...rest };
        
        if (address) {
          // Busca lat/lng automaticamente pelo CEP
          if (formData.delivery_active && address.cep) {
            try {
              const resGeo = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${address.cep.replace(/[^0-9]/g, '')}&country=Brazil&format=json`);
              const geodata = await resGeo.json();
              if (geodata && geodata.length > 0) {
                address.lat = parseFloat(geodata[0].lat);
                address.lng = parseFloat(geodata[0].lon);
              }
            } catch (e) {
              console.error('Falha ao buscar coordenadas:', e);
            }
          }
          // Atualiza também no Dexie se encontrou
          if (address.lat && address.lng) {
             await db.settings.update(1, { address });
          }

          const { lat, lng, ...addrRest } = address;
          (apiPayload as any) = { ...apiPayload, ...addrRest, lat: lat as number, lng: lng as number };
        }
        await api.put('/settings', apiPayload);
      } catch (apiErr) {
        console.error('Falha ao sincronizar configurações com o servidor:', apiErr);
      }
      
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar as configurações.');
    }
  };

  return (
    <div className="settings-container">
      <div className="page-header">
        <h1 className="page-title">Configurações Gerais</h1>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        
        {/* BLOCO 1: Informações da Empresa */}
        <div className="settings-card glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggleSection('loja')}>
            <div>
              <h2 style={{ margin: 0 }}>Informações da Loja</h2>
              <p className="card-subtitle" style={{ margin: 0, marginTop: '0.2rem' }}>Dados principais da sua loja ou empresa</p>
            </div>
            {expandedSections.loja ? <ChevronUp size={24} color="var(--text-muted)" /> : <ChevronDown size={24} color="var(--text-muted)" />}
          </div>
          
          {expandedSections.loja && (
            <div style={{ marginTop: '1.5rem' }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Nome Fantasia</label>
                  <input type="text" placeholder="Nome Fantasia" value={formData.tradeName} onChange={e => setFormData({...formData, tradeName: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Razão Social</label>
                  <input type="text" placeholder="Razão Social" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>CNPJ</label>
                  <input type="text" placeholder="00.000.000/0000-00" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: maskCNPJ(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label>Data de Nascimento (Administrador)</label>
                  <input type="text" placeholder="DD/MM/AAAA" value={formData.ownerBirthDate} onChange={e => setFormData({...formData, ownerBirthDate: maskDate(e.target.value)})} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Telefone / WhatsApp</label>
                  <input type="text" required placeholder="(00) 00000-0000" value={formData.phone} onChange={e => setFormData({...formData, phone: maskPhone(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label>E-mail de Contato</label>
                  <input type="email" placeholder="loja@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>

              <div className="form-group">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem'}}>
                  <label style={{marginBottom: 0}}>Endereço</label>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Mostrar na Loja para o Cliente</span>
                    <label className="toggle-switch" style={{ transform: 'scale(0.8)', transformOrigin: 'right' }}>
                      <input type="checkbox" checked={formData.show_address_storefront ?? true} onChange={e => setFormData({...formData, show_address_storefront: e.target.checked})} />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>CEP</label>
                    <input type="text" maxLength={9} placeholder="00000-000" value={formData.address?.cep || ''} onChange={handleCepChange} />
                  </div>
                  <div className="form-group">
                    <label>UF</label>
                    <input type="text" maxLength={2} placeholder="SP" value={formData.address?.state || ''} onChange={e => setFormData({...formData, address: {...formData.address!, state: e.target.value}})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{flex: 2}}>
                    <label>Rua / Avenida</label>
                    <input type="text" value={formData.address?.street || ''} onChange={e => setFormData({...formData, address: {...formData.address!, street: e.target.value}})} />
                  </div>
                  <div className="form-group">
                    <label>Número</label>
                    <input type="text" value={formData.address?.number || ''} onChange={e => setFormData({...formData, address: {...formData.address!, number: e.target.value}})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Bairro</label>
                    <input type="text" value={formData.address?.neighborhood || ''} onChange={e => setFormData({...formData, address: {...formData.address!, neighborhood: e.target.value}})} />
                  </div>
                  <div className="form-group">
                    <label>Cidade</label>
                    <input type="text" value={formData.address?.city || ''} onChange={e => setFormData({...formData, address: {...formData.address!, city: e.target.value}})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Complemento / Observação</label>
                  <input type="text" value={formData.address?.observation || ''} onChange={e => setFormData({...formData, address: {...formData.address!, observation: e.target.value}})} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BLOCO 2.1: Jornada de Atendimento */}
        <div className="settings-card glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggleSection('jornada')}>
            <div>
              <h2 style={{ margin: 0 }}>Jornada de Atendimento</h2>
              <p className="card-subtitle" style={{ margin: 0, marginTop: '0.2rem' }}>Configure os dias e horários de funcionamento da sua loja, incluindo intervalos.</p>
            </div>
            {expandedSections.jornada ? <ChevronUp size={24} color="var(--text-muted)" /> : <ChevronDown size={24} color="var(--text-muted)" />}
          </div>
          
          {expandedSections.jornada && (
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map((day, index) => (
                <div key={index} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, color: 'var(--text-main)', width: '120px' }}>{day}</h4>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={parsedHours[index].isOpen} 
                        onChange={e => {
                          const newArr = [...parsedHours];
                          newArr[index].isOpen = e.target.checked;
                          setParsedHours(newArr);
                        }} 
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  
                  {parsedHours[index].isOpen ? (
                    <div className="form-row" style={{ marginTop: '0.5rem', gap: '1rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem' }}>Abertura</label>
                        <input type="time" value={parsedHours[index].openTime} onChange={e => { const arr = [...parsedHours]; arr[index].openTime = e.target.value; setParsedHours(arr); }} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem' }}>Início do Intervalo</label>
                        <input type="time" value={parsedHours[index].breakStart} onChange={e => { const arr = [...parsedHours]; arr[index].breakStart = e.target.value; setParsedHours(arr); }} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem' }}>Fim do Intervalo</label>
                        <input type="time" value={parsedHours[index].breakEnd} onChange={e => { const arr = [...parsedHours]; arr[index].breakEnd = e.target.value; setParsedHours(arr); }} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem' }}>Fechamento</label>
                        <input type="time" value={parsedHours[index].closeTime} onChange={e => { const arr = [...parsedHours]; arr[index].closeTime = e.target.value; setParsedHours(arr); }} />
                      </div>
                    </div>
                  ) : (
                     <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Loja Fechada neste dia.</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BLOCO 2.5: Frete e Entregas */}
        <div className="settings-card glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggleSection('frete')}>
            <div>
              <h2 style={{ margin: 0 }}>Frete e Entregas</h2>
              <p className="card-subtitle" style={{ margin: 0, marginTop: '0.2rem' }}>Configure as taxas de entrega para os pedidos feitos na loja online (Storefront).</p>
            </div>
            {expandedSections.frete ? <ChevronUp size={24} color="var(--text-muted)" /> : <ChevronDown size={24} color="var(--text-muted)" />}
          </div>
          
          {expandedSections.frete && (
            <div style={{ marginTop: '1.5rem' }}>
              <div className="rule-section">
                <div className="rule-header">
                  <div className="rule-title">
                    <h4>Habilitar Entregas</h4>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={formData.delivery_active || false} onChange={e => setFormData({...formData, delivery_active: e.target.checked})} />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <p>Permitir que os clientes escolham a opção de entrega ao finalizar o carrinho.</p>
                </div>
                
                <div className={`rule-body ${!formData.delivery_active ? 'disabled' : ''}`}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Taxa Fixa Base (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 5,00" 
                        value={maskCurrency(formData.delivery_fixed_fee ?? 0)} 
                        onChange={e => setFormData({...formData, delivery_fixed_fee: parseCurrency(e.target.value) as number})}
                        disabled={!formData.delivery_active}
                      />
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Taxa inicial cobrada apenas por sair com o pedido.</p>
                    </div>
                    
                    <div className="form-group">
                      <label>Valor Adicional por KM</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 1,50" 
                        value={maskCurrency(formData.delivery_fee_per_km ?? 0)} 
                        onChange={e => setFormData({...formData, delivery_fee_per_km: parseCurrency(e.target.value) as number})}
                        disabled={!formData.delivery_active}
                      />
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ex: R$ 1,50 somado a cada KM percorrido.</p>
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Valor Mínimo para Entrega (R$)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 50,00" 
                        value={maskCurrency(formData.delivery_min_order_value ?? 0)} 
                        onChange={e => setFormData({...formData, delivery_min_order_value: parseCurrency(e.target.value) as number})}
                        disabled={!formData.delivery_active}
                      />
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pedidos abaixo desse valor não terão a opção de entrega disponível.</p>
                    </div>
                    
                    <div className="form-group">
                      <label>Distância Máxima (Perímetro Urbano em KM)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0"
                        placeholder="Ex: 15" 
                        value={formData.delivery_max_distance_km ?? 0} 
                        onChange={e => setFormData({...formData, delivery_max_distance_km: parseFloat(e.target.value) || 0})}
                        disabled={!formData.delivery_active}
                      />
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bloqueia entregas para clientes além desse limite de quilometragem da loja.</p>
                    </div>
                  </div>
                  
                  <p style={{ fontSize: '0.9rem', color: 'var(--warning)', marginTop: '1rem' }}>
                    * Lembre-se: O sistema usará o endereço cadastrado da loja (Bloco 1) para calcular a distância até o endereço informado pelo cliente no carrinho.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>



        {/* BLOCO 3: Integração e Comunicação (Mensageria) */}
        <div className="settings-card glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggleSection('mensagens')}>
            <div>
              <h2 style={{ margin: 0 }}>Integração de Mensagens</h2>
              <p className="card-subtitle" style={{ margin: 0, marginTop: '0.2rem' }}>Configure as chaves e credenciais para o disparo de notificações de dívidas e vitrines aos clientes</p>
            </div>
            {expandedSections.mensagens ? <ChevronUp size={24} color="var(--text-muted)" /> : <ChevronDown size={24} color="var(--text-muted)" />}
          </div>
          
          {expandedSections.mensagens && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{fontSize: '1.05rem', margin: '1rem 0', color: 'var(--success)'}}>Conexão WhatsApp</h3>
              <div className="form-row">
                 <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <label>Provedor da API</label>
                    <select 
                      value={formData.whatsapp_provider || 'evolution'} 
                      onChange={e => setFormData({...formData, whatsapp_provider: e.target.value})}
                      style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-main)', width: '100%' }}
                    >
                      <option value="evolution" style={{ color: '#000' }}>Evolution API</option>
                      <option value="zapi" style={{ color: '#000' }}>Z-API</option>
                    </select>
                 </div>
              </div>
              <div className="form-row">
                 <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <label>URL da API ({formData.whatsapp_provider === 'zapi' ? 'Ex: https://api.z-api.io/instances/SUA_INSTANCIA/token/SEU_TOKEN' : 'Ex: http://192.168.1.10:8080'})</label>
                    <input type="text" placeholder="Cole a URL da API aqui" value={formData.whatsapp_url || ''} onChange={e => setFormData({...formData, whatsapp_url: e.target.value})} />
                 </div>
              </div>
              <div className="form-row">
                 <div className="form-group">
                    <label>{formData.whatsapp_provider === 'zapi' ? 'Client-Token (Opcional p/ Z-API)' : 'WhatsApp Secret Token (API)'}</label>
                    <input type="password" placeholder="Cole o token permanente" value={formData.whatsapp_token || ''} onChange={e => setFormData({...formData, whatsapp_token: e.target.value})} />
                 </div>
                 <div className="form-group">
                    <label>{formData.whatsapp_provider === 'zapi' ? 'ID da Instância (Opcional p/ Z-API)' : 'ID da Instância (Session/Device)'}</label>
                    <input type="text" placeholder="Ex: instance12345" value={formData.whatsapp_instance || ''} onChange={e => setFormData({...formData, whatsapp_instance: e.target.value})} />
                 </div>
              </div>

              <h3 style={{fontSize: '1.05rem', margin: '1rem 0', color: 'var(--primary)'}}>Conexão E-mail (Servidor SMTP / API)</h3>
              <div className="form-row">
                 <div className="form-group">
                    <label>Chave de Autorização (Token/Password)</label>
                    <input type="password" placeholder="Cole a chave de acesso" value={formData.email_token || ''} onChange={e => setFormData({...formData, email_token: e.target.value})} />
                 </div>
                 <div className="form-group">
                    <label>Remetente Base (Sender Address)</label>
                    <input type="email" placeholder="notifica@minhaloja.com" value={formData.email_sender || ''} onChange={e => setFormData({...formData, email_sender: e.target.value})} />
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* BLOCO 4: Integração de Pagamentos Online */}
        <div className="settings-card glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggleSection('pagamentos')}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <h2 style={{ margin: 0 }}>Pagamentos Online (Gateway)</h2>
                <div onClick={e => e.stopPropagation()} style={{ marginRight: '1rem' }}>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={formData.online_payment_active || false} onChange={e => setFormData({...formData, online_payment_active: e.target.checked})} />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
              <p className="card-subtitle" style={{ margin: 0 }}>Configure o gateway para receber pagamentos via link, pix e boleto de forma automática.</p>
            </div>
            {expandedSections.pagamentos ? <ChevronUp size={24} color="var(--text-muted)" /> : <ChevronDown size={24} color="var(--text-muted)" />}
          </div>
          
          {expandedSections.pagamentos && (
            <div style={{ marginTop: '1.5rem' }}>
              <div className={`rule-body ${!formData.online_payment_active ? 'disabled' : ''}`}>
                <div className="form-group">
                  <label>Gateway de Pagamento</label>
                  <select 
                    value={formData.payment_gateway || ''} 
                    onChange={e => setFormData({...formData, payment_gateway: e.target.value})}
                    disabled={!formData.online_payment_active}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
                  >
                    <option value="" style={{ background: 'var(--bg-panel)' }}>Selecione um gateway...</option>
                    <option value="mercadopago" style={{ background: 'var(--bg-panel)' }}>Mercado Pago</option>
                    <option value="asaas" style={{ background: 'var(--bg-panel)' }}>Asaas</option>
                    <option value="stripe" style={{ background: 'var(--bg-panel)' }}>Stripe</option>
                    <option value="pagseguro" style={{ background: 'var(--bg-panel)' }}>PagSeguro</option>
                  </select>
                </div>
                <div className="form-row" style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label>Token de Acesso (API Key / Access Token)</label>
                    <input 
                      type="password" 
                      placeholder="Cole a chave de API de produção" 
                      value={formData.payment_api_key || ''} 
                      onChange={e => setFormData({...formData, payment_api_key: e.target.value})}
                      disabled={!formData.online_payment_active}
                    />
                  </div>
                  <div className="form-group">
                    <label>Segredo do Webhook (Webhook Secret)</label>
                    <input 
                      type="password" 
                      placeholder="Chave secreta para validação de retornos" 
                      value={formData.payment_webhook_secret || ''} 
                      onChange={e => setFormData({...formData, payment_webhook_secret: e.target.value})}
                      disabled={!formData.online_payment_active}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button type="submit" className="btn-primary btn-save">
            <Save size={20} />
            Salvar Configurações
          </button>
          
          {isSaved && (
            <div className="save-toast">
              <ShieldCheck size={20} />
              Salvo com sucesso!
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
