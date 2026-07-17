import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, Store, Eye, EyeOff, ChevronRight, Shield, ShoppingBag, Briefcase } from 'lucide-react';
import { api } from '../services/api';
import './Login.css';

type Step = 'CPF' | 'ROLE' | 'PASSWORD';

export default function Login() {
  const [step, setStep] = useState<Step>('CPF');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tradeName, setTradeName] = useState('GestãoPro');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data && res.data.tradeName) {
          setTradeName(res.data.tradeName);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSettings();
  }, []);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
    if (value.length > 11) value = value.slice(0, 11);
    
    // Aplica a máscara: 000.000.000-00
    if (value.length > 9) {
      value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2}).*/, '$1.$2.$3-$4');
    } else if (value.length > 6) {
      value = value.replace(/^(\d{3})(\d{3})(\d{1,3}).*/, '$1.$2.$3');
    } else if (value.length > 3) {
      value = value.replace(/^(\d{3})(\d{1,3}).*/, '$1.$2');
    }
    
    setCpf(value);
  };

  // Quando submete o CPF, vamos direto para a senha
  const handleCpfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cpf.replace(/\D/g, '').length < 11) {
      setError('CPF inválido.');
      return;
    }
    setError('');
    setStep('PASSWORD');
  };

  // Quando escolhe o perfil (se tiver mais de um)
  const handleRoleSelect = async (role: string) => {
    setError('');
    setLoading(true);
    
    const result = await login(cpf, password, role);
    setLoading(false);
    
    if (result && result.success) {
      if (result.role === 'CUSTOMER') {
        navigate('/loja', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } else {
      setError('Erro ao logar com o perfil selecionado.');
    }
  };

  // Quando envia a senha
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Por favor, informe a senha.');
      return;
    }
    setError('');
    setLoading(true);

    const result = await login(cpf, password);
    setLoading(false);
    
    if (result && result.success) {
      if (result.requireRoleSelection) {
        setRoles(result.availableRoles || []);
        setStep('ROLE'); // Vai para a tela de escolher o perfil
      } else {
        // Logado direto (só tinha 1 perfil)
        if (result.role === 'CUSTOMER') {
          navigate('/loja', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    } else {
      setError('Senha incorreta ou erro de conexão.');
    }
  };

  const getRoleInfo = (r: string) => {
    if (r === 'ADMIN') return { icon: <Shield size={24} />, label: 'Administrador' };
    if (r === 'EMPLOYEE') return { icon: <Briefcase size={24} />, label: 'Funcionário' };
    return { icon: <ShoppingBag size={24} />, label: 'Cliente' };
  };

  return (
    <div className="login-container">
      <div className="login-box glass-panel">
        <div className="login-header">
          <div className="icon">
            <Store size={32} />
          </div>
          <h1>{tradeName}</h1>
          <p>Faça login para continuar</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {step === 'CPF' && (
          <form className="login-form" onSubmit={handleCpfSubmit}>
            <div className="input-group">
              <label htmlFor="cpf">CPF</label>
              <div className="input-with-icon">
                <User />
                <input
                  type="text"
                  id="cpf"
                  placeholder="Digite seu CPF"
                  value={cpf}
                  onChange={handleCpfChange}
                  autoFocus
                />
              </div>
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Verificando...' : 'Continuar'} <ChevronRight size={18} style={{ marginLeft: 8 }} />
            </button>
            <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Não tem uma conta? </span>
              <Link to="/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>Cadastre-se</Link>
            </div>
          </form>
        )}

        {step === 'ROLE' && (
          <div className="roles-container">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', textAlign: 'center' }}>Escolha como deseja acessar:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {roles.map(r => {
                const info = getRoleInfo(r);
                return (
                  <button 
                    key={r} 
                    className="role-btn" 
                    onClick={() => handleRoleSelect(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 500, transition: 'all 0.2s' }}
                  >
                    <div style={{ color: 'var(--primary)' }}>{info.icon}</div>
                    {info.label}
                    <ChevronRight size={18} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                  </button>
                );
              })}
            </div>
            <button className="login-btn outline" onClick={() => setStep('CPF')} style={{ marginTop: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
              Voltar
            </button>
          </div>
        )}

        {step === 'PASSWORD' && (
          <form className="login-form" onSubmit={handleLoginSubmit}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Identificação confirmada</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>CPF: {cpf}</p>
            </div>

            <div className="input-group">
              <label htmlFor="password">Senha</label>
              <div className="input-with-icon">
                <Lock />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
              <Link to="/forgot-password" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.85rem' }}>Esqueci minha senha</Link>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
            <button type="button" className="login-btn outline" onClick={() => { setStep('CPF'); setPassword(''); }} style={{ marginTop: '0.5rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
              Voltar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
