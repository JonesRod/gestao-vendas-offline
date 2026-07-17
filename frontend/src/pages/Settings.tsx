import { useState, useEffect } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Settings as SettingsType } from '../db/db';
import { api } from '../services/api';
import { maskCNPJ, maskPhone, maskCEP, fetchAddressByCep, maskDate } from '../utils/masks';
import './Settings.css';

export default function Settings() {
  const settingsData = useLiveQuery(() => db.settings.get(1));
  const [isSaved, setIsSaved] = useState(false);
  const [showAddress, setShowAddress] = useState(false);

  const initialFormState: Partial<SettingsType> = {
    email: '', phone: '', tradeName: '', companyName: '', cnpj: '', ownerBirthDate: '',
    address: { cep: '', street: '', number: '', neighborhood: '', city: '', state: '', observation: '' },
    show_address_storefront: true,
    loyalty_active: false, loyalty_days: 30,
    penalty_active: false, penalty_percent: 2, interest_percent: 1,
    whatsapp_token: '', whatsapp_instance: '', email_token: '', email_sender: '',
    online_payment_active: false, payment_gateway: '', payment_api_key: '', payment_webhook_secret: ''
  };

  const [formData, setFormData] = useState<Partial<SettingsType>>(initialFormState);

  useEffect(() => {
    if (settingsData) {
      setFormData(settingsData);
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
      const dataToSave = { ...formData, updated_at: new Date() } as SettingsType;
      
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
          const { lat, lng, ...addrRest } = address;
          apiPayload = { ...apiPayload, ...addrRest };
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
          <h2>Informações da Loja</h2>
          <p className="card-subtitle">Dados principais da sua loja ou empresa</p>
          
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
          
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0 0.5rem'}}>
            <h3 style={{fontSize: '0.95rem', margin: 0, color: 'var(--text-muted)'}}>Endereço</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Mostrar na Loja para o Cliente</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={formData.show_address_storefront !== false} onChange={e => setFormData({...formData, show_address_storefront: e.target.checked})} />
                <span className="slider"></span>
              </label>
            </div>
          </div>
          
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-row">
              <div className="form-group">
                <label>CEP</label>
                <input type="text" placeholder="00000-000" value={formData.address?.cep || ''} onChange={handleCepChange} />
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

        {/* BLOCO 2: Automações de Fidelidade */}
        <div className="settings-card glass-panel">
          <h2>Regras e Automações</h2>
          <p className="card-subtitle">Configure as políticas de fidelidade e cobranças</p>
          
          <div className="rule-section">
            <div className="rule-header">
              <div className="rule-title">
                <h4>Status de Cliente Fiel</h4>
                <label className="toggle-switch">
                  <input type="checkbox" checked={formData.loyalty_active} onChange={e => setFormData({...formData, loyalty_active: e.target.checked})} />
                  <span className="slider"></span>
                </label>
              </div>
              <p>Perda de fidelidade caso o cliente fique sem comprar por X dias.</p>
            </div>
            <div className={`rule-body ${!formData.loyalty_active ? 'disabled' : ''}`}>
              <div className="form-row">
                <div className="form-group">
                  <label>Dias de Inatividade Permitidos</label>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <input type="number" min="1" value={formData.loyalty_days} onChange={e => setFormData({...formData, loyalty_days: Number(e.target.value)})} disabled={!formData.loyalty_active} style={{maxWidth: '120px'}} />
                    <span>dias</span>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>* Os valores de desconto de cliente fiel devem ser configurados individualmente dentro do cadastro de cada produto.</p>
            </div>
          </div>
          <div className="rule-section">
            <div className="rule-header">
              <div className="rule-title">
                <h4>Desconto de Pontualidade Global</h4>
                <label className="toggle-switch">
                  <input type="checkbox" checked={formData.punctuality_discount_active || false} onChange={e => setFormData({...formData, punctuality_discount_active: e.target.checked})} />
                  <span className="slider"></span>
                </label>
              </div>
              <p>Aplicar desconto se o cliente pagar a parcela até a data de vencimento.</p>
            </div>
            <div className={`rule-body ${!formData.punctuality_discount_active ? 'disabled' : ''}`}>
              <div className="form-row">
                <div className="form-group">
                  <label>Dias de Tolerância para Desconto</label>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <input type="number" min="0" value={formData.punctuality_discount_days || 0} onChange={e => setFormData({...formData, punctuality_discount_days: Number(e.target.value)})} disabled={!formData.punctuality_discount_active} style={{maxWidth: '120px'}} />
                    <span>dias</span>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>* Os valores de desconto de pontualidade devem ser configurados individualmente dentro do cadastro de cada produto.</p>
            </div>
          </div>

          <div className="rule-section">
            <div className="rule-header">
              <div className="rule-title">
                <h4>Multa e Juros por Atraso</h4>
                <label className="toggle-switch">
                  <input type="checkbox" checked={formData.penalty_active} onChange={e => setFormData({...formData, penalty_active: e.target.checked})} />
                  <span className="slider"></span>
                </label>
              </div>
              <p>Adicionar encargos em compras a prazo estouradas.</p>
            </div>
            <div className={`rule-body ${!formData.penalty_active ? 'disabled' : ''}`}>
              <div className="form-row">
                <div className="form-group">
                  <label>Multa (Fixa %)</label>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <input type="number" min="0" step="0.1" value={formData.penalty_percent} onChange={e => setFormData({...formData, penalty_percent: Number(e.target.value)})} disabled={!formData.penalty_active} />
                    <span>%</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Juros (Ao Mês %)</label>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <input type="number" min="0" step="0.1" value={formData.interest_percent} onChange={e => setFormData({...formData, interest_percent: Number(e.target.value)})} disabled={!formData.penalty_active} />
                    <span>%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* BLOCO 3: Integração e Comunicação (Mensageria) */}
        <div className="settings-card glass-panel">
          <h2>Integração de Mensagens</h2>
          <p className="card-subtitle">Configure as chaves e credenciais para o disparo de notificações de dívidas e vitrines aos clientes</p>
          
          <h3 style={{fontSize: '1.05rem', margin: '1rem 0', color: 'var(--success)'}}>Conexão WhatsApp</h3>
          <div className="form-row">
             <div className="form-group">
                <label>WhatsApp Secret Token (API)</label>
                <input type="password" placeholder="Cole o token permanente" value={formData.whatsapp_token || ''} onChange={e => setFormData({...formData, whatsapp_token: e.target.value})} />
             </div>
             <div className="form-group">
                <label>ID da Instância (Session/Device)</label>
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

        {/* BLOCO 4: Integração de Pagamentos Online */}
        <div className="settings-card glass-panel">
          <div className="rule-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <div className="rule-title">
              <h2>Pagamentos Online (Gateway)</h2>
              <label className="toggle-switch">
                <input type="checkbox" checked={formData.online_payment_active || false} onChange={e => setFormData({...formData, online_payment_active: e.target.checked})} />
                <span className="slider"></span>
              </label>
            </div>
            <p className="card-subtitle" style={{ marginTop: '0.5rem' }}>Configure o gateway para receber pagamentos via link, pix e boleto de forma automática.</p>
          </div>
          
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
