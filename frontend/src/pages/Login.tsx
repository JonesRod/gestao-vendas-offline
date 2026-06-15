import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, Store } from 'lucide-react';
import './Login.css';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.trim() === '') {
      setError('Por favor, informe a senha.');
      return;
    }

    const success = await login(password);
    if (success) {
      navigate('/dashboard', { replace: true });
    } else {
      setError('Senha incorreta ou erro de conexão.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box glass-panel">
        <div className="login-header">
          <div className="icon">
            <Store size={32} />
          </div>
          <h1>Acesso Restrito</h1>
          <p>Área exclusiva para administradores</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          {error && <div className="error-message">{error}</div>}

          <div className="input-group">
            <label htmlFor="user">Usuário</label>
            <div className="input-with-icon">
              <User />
              <input
                type="text"
                id="user"
                value="admin"
                disabled
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Senha</label>
            <div className="input-with-icon">
              <Lock />
              <input
                type="password"
                id="password"
                placeholder="Digite a senha (admin)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <button type="submit" className="login-btn">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
