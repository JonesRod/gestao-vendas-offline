import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Store, ChevronRight, Mail, Phone, Lock, EyeOff, Eye } from 'lucide-react';
import { api } from '../services/api';
import { maskCPF, maskPhone } from '../utils/masks';
import './Login.css';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    email: '',
    phone: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, cpf: maskCPF(e.target.value) });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, phone: maskPhone(e.target.value) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.cpf.replace(/\D/g, '').length < 11) {
      setError('CPF inválido.');
      return;
    }
    if (!formData.name || !formData.phone || !formData.password) {
      setError('Preencha os campos obrigatórios (Nome, Celular e Senha).');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/register', formData);
      if (res.data.success) {
        alert('Cadastro realizado com sucesso! Faça login para continuar.');
        navigate('/login');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao realizar o cadastro. Verifique os dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box glass-panel" style={{ maxWidth: '450px' }}>
        <div className="login-header">
          <div className="icon">
            <Store size={32} />
          </div>
          <h1>Criar Conta</h1>
          <p>Cadastre-se para acessar a loja</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="name">Nome Completo *</label>
            <div className="input-with-icon">
              <User />
              <input
                type="text"
                id="name"
                placeholder="Seu nome"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label htmlFor="cpf">CPF *</label>
              <div className="input-with-icon">
                <input
                  type="text"
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  onChange={handleCpfChange}
                  required
                  style={{ paddingLeft: '1rem' }}
                />
              </div>
            </div>

            <div className="input-group" style={{ flex: 1 }}>
              <label htmlFor="phone">Celular *</label>
              <div className="input-with-icon">
                <Phone />
                <input
                  type="text"
                  id="phone"
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="email">E-mail</label>
            <div className="input-with-icon">
              <Mail />
              <input
                type="email"
                id="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Senha *</label>
            <div className="input-with-icon">
              <Lock />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Crie uma senha"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading} style={{ marginTop: '1rem' }}>
            {loading ? 'Cadastrando...' : 'Finalizar Cadastro'} <ChevronRight size={18} style={{ marginLeft: 8 }} />
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Já tem uma conta? </span>
            <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>Faça Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
