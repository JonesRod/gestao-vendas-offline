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
  const navigate = useNavigate();

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
    if (value.length > 11) value = value.slice(0, 11);
    
    // Aplica a máscara 000.000.000-00
    if (value.length > 9) value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    else if (value.length > 6) value = value.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
    else if (value.length > 3) value = value.replace(/(\d{3})(\d{3})/, "$1.$2");
    
    setCpf(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cpf.replace(/\D/g, '').length < 11) {
      setError('CPF inválido.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { cpf });
      setMessage(response.data.message || 'Instruções de recuperação enviadas. (Simulação)');
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

          <button type="submit" className="btn-primary login-btn" disabled={loading}>
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
