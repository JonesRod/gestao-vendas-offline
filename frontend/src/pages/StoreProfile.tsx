import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Phone, MapPin, Calendar, CreditCard } from 'lucide-react';
import './StoreProfile.css';

export default function StoreProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [creditInfo, setCreditInfo] = useState({
    limit: 0,
    used: 0,
    is_blocked: false,
    status: ''
  });
  
  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    phone: '',
    email: '',
    birthDate: '',
    cep: '',
    address: '',
    number: '',
    neighborhood: '',
    city: '',
    state: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      try {
        const response = await api.get(`/customers/${user.id}`);
        if (response.data) {
          const d = response.data;
          setFormData({
            name: d.name || '',
            cpf: d.cpf || '',
            phone: d.phone || '',
            email: d.email || '',
            birthDate: d.birthDate || '',
            cep: d.cep || '',
            address: d.address || '',
            number: d.number || '',
            neighborhood: d.neighborhood || '',
            city: d.city || '',
            state: d.state || ''
          });
          setCreditInfo({
            limit: d.credit_limit || 0,
            used: d.credit_used || 0,
            is_blocked: d.is_blocked || false,
            status: d.status || 'ativo'
          });
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setFormData(prev => ({ ...prev, cpf: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
    value = value.replace(/(\d)(\d{4})$/, '$1-$2');
    setFormData(prev => ({ ...prev, phone: value }));
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    value = value.replace(/^(\d{5})(\d)/, '$1-$2');
    setFormData(prev => ({ ...prev, cep: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      await api.put(`/customers/${user.id}`, formData);
      setMessage({ text: 'Perfil atualizado com sucesso!', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Erro ao atualizar perfil.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="store-container" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Carregando perfil...</p>
      </div>
    );
  }

  return (
    <div className="store-container profile-page">
      <div className="profile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <button 
            onClick={() => window.history.back()} 
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Voltar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h2 className="profile-title" style={{ margin: 0 }}>Meu Perfil</h2>
        </div>
        <p className="profile-subtitle">Gerencie suas informações pessoais e endereço de entrega.</p>
      </div>

      {message.text && (
        <div className={`alert ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="profile-form glass-panel" style={{ marginBottom: '2rem' }}>
        <div className="form-section" style={{ background: 'rgba(46, 204, 113, 0.05)', border: '1px solid rgba(46, 204, 113, 0.2)', padding: '1.5rem', borderRadius: '12px' }}>
          <h3 style={{ color: 'var(--success)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={20} /> Meu Crediário
          </h3>
          
          <div className="form-grid">
            <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px' }}>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Status do Crediário</span>
              <strong className={creditInfo.is_blocked ? 'text-danger' : 'text-success'} style={{ fontSize: '1.1rem' }}>
                {creditInfo.is_blocked ? 'BLOQUEADO' : (creditInfo.limit > 0 ? 'ATIVO' : 'INATIVO')}
              </strong>
            </div>
            
            {creditInfo.limit > 0 ? (
              <>
                <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px' }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Limite Total</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    R$ {creditInfo.limit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </strong>
                </div>
                <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px' }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Crédito Disponível</span>
                  <strong className={(creditInfo.limit - creditInfo.used) <= 0 ? 'text-danger' : 'text-success'} style={{ fontSize: '1.1rem' }}>
                    R$ {(creditInfo.limit - creditInfo.used).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </strong>
                </div>
              </>
            ) : (
              <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', gridColumn: 'span 2' }}>
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Aviso</span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  Você ainda não possui limite de crédito aprovado para compras a prazo.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <form className="profile-form glass-panel" onSubmit={handleSubmit}>
        <div className="form-section">
          <h3><User size={18} /> Dados Pessoais</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Nome Completo</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>CPF</label>
              <input type="text" name="cpf" value={formData.cpf} onChange={handleCpfChange} required />
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Telefone / WhatsApp</label>
              <input type="text" name="phone" value={formData.phone} onChange={handlePhoneChange} />
            </div>
            <div className="form-group">
              <label>Data de Nascimento</label>
              <input type="text" name="birthDate" placeholder="DD/MM/AAAA" value={formData.birthDate} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3><MapPin size={18} /> Endereço</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>CEP</label>
              <input type="text" name="cep" value={formData.cep} onChange={handleCepChange} />
            </div>
            <div className="form-group">
              <label>Rua / Avenida</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Número</label>
              <input type="text" name="number" value={formData.number} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Bairro</label>
              <input type="text" name="neighborhood" value={formData.neighborhood} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Cidade</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Estado (UF)</label>
              <input type="text" name="state" value={formData.state} onChange={handleChange} maxLength={2} style={{ textTransform: 'uppercase' }} />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="save-btn" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}
