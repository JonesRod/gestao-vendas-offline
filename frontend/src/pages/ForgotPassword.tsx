import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import './Login.css';

export default function ForgotPassword() {
  const [cpf, setCpf] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<{type: string, value: string, masked: string}[]>([]);
  const [selectedContact, setSelectedContact] = useState<string>('');
  const navigate = useNavigate();

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
    if (value.length > 11) value = value.slice(0, 11);
    
    // Aplica a máscara 000.000.000-00
    if (value.length > 9) value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    else if (value.length > 6) value = value.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
    else if (value.length > 3) value = value.replace(/(\d{3})(\d{3})/, "$1.$2");
    
    setCpf(value);

    if (value.length === 14) {
      api.get(`/auth/contacts?cpf=${value}`)
        .then(res => {
          if (res.data.error) {
            setContacts([]);
            setError(res.data.error);
          } else {
            const list = res.data.contacts || [];
            setContacts(list);
            if (list.length > 0) {
              setSelectedContact(list[0].type);
              setError('');
            } else {
              setError('Nenhum contato encontrado para este CPF.');
            }
          }
        })
        .catch(err => {
          setContacts([]);
          setError('Erro ao buscar usuário.');
        });
    } else {
      setContacts([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cpf.replace(/\D/g, '').length < 11) {
      setError('CPF inválido.');
      return;
    }
    if (contacts.length > 0 && !selectedContact) {
      setError('Selecione um método de contato.');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { cpf, method: selectedContact });
      setMessage(response.data.message || 'Instruções de recuperação enviadas. (Simulação)');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Erro ao solicitar recuperação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box glass-panel">
        <div className="login-header">
          <div className="logo-container">
            <Shield size={36} className="logo-icon" />
          </div>
          <h1>Recuperar Senha</h1>
          <p>Digite seu CPF para receber as instruções</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(34, 197, 94, 0.2)' }}>{message}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>CPF</label>
            <div className="input-with-icon">
              <input 
                type="text" 
                placeholder="000.000.000-00" 
                value={cpf}
                onChange={handleCpfChange}
                required
                autoFocus
              />
            </div>
          </div>

          {contacts.length > 0 && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Escolha onde receber o link:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.5rem' }}>
                {contacts.map((c, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.8rem', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <input 
                      type="radio" 
                      name="contactMethod" 
                      value={c.type}
                      checked={selectedContact === c.type}
                      onChange={() => setSelectedContact(c.type)}
                      style={{ accentColor: 'var(--primary)', width: '1.2rem', height: '1.2rem', margin: 0, flexShrink: 0 }}
                    />
                    <span style={{ color: 'var(--text-main)', fontSize: '0.95rem', wordBreak: 'break-word', textAlign: 'left', lineHeight: '1.4' }}>
                      {c.type === 'email' ? 'E-mail: ' : 'WhatsApp: '}
                      <strong>{c.masked}</strong>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary login-btn" disabled={loading || (contacts.length > 0 && !selectedContact)}>
            {loading ? 'Processando...' : 'Enviar Instruções'}
          </button>
        </form>

        <div className="login-footer">
          <Link to="/login" className="forgot-password-link" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={16} /> Voltar para o Login
          </Link>
        </div>
      </div>
    </div>
  );
}
