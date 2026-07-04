import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Package } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './StoreLayout.css';

export default function StoreLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="store-layout">
      <header className="store-header">
        <div className="store-container header-content">
          <Link to="/loja" className="store-logo">
            <Package size={32} className="logo-icon" />
            <span>Minha Loja</span>
          </Link>

          <div className="store-nav">
            <Link to="/loja/pedidos" className="nav-link">Meus Pedidos</Link>
          </div>

          <div className="store-actions">
            <button className="cart-btn">
              <ShoppingCart size={24} />
              <span className="cart-badge">0</span>
            </button>
            
            <div className="user-menu">
              <button className="user-btn">
                <User size={24} />
                <span className="user-greeting">Olá, {user?.name ? user.name.split(' ')[0] : 'Cliente'}</span>
              </button>
              <div className="dropdown">
                <Link to="/loja/perfil" className="dropdown-item">
                  <User size={18} />
                  Meu Perfil
                </Link>
                <button onClick={handleLogout} className="dropdown-item text-danger">
                  <LogOut size={18} />
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="store-main">
        <Outlet />
      </main>

      <footer className="store-footer">
        <div className="store-container">
          <p>&copy; {new Date().getFullYear()} Minha Loja. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
