import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Package, ClipboardList, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import './StoreLayout.css';

export default function StoreLayout() {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
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

          <div className="store-actions">
            <Link to="/loja/faturas" className="cart-btn" title="Minhas Faturas">
              <CreditCard size={24} />
            </Link>

            <Link to="/loja/pedidos" className="cart-btn" title="Meus Pedidos">
              <ClipboardList size={24} />
            </Link>

            <Link to="/loja/carrinho" className="cart-btn" title="Meu Carrinho">
              <ShoppingCart size={24} />
              <span className="cart-badge">{cartCount}</span>
            </Link>
            
            <div className="user-menu">
              <button className="user-btn">
                <User size={24} />
                <span className="user-greeting">Olá, {user?.name ? user.name.split(' ')[0] : 'Cliente'}</span>
              </button>
              <div className="dropdown">
                <Link to="/loja/pedidos" className="dropdown-item">
                  <ClipboardList size={18} />
                  Minhas Compras
                </Link>
                <Link to="/loja/faturas" className="dropdown-item">
                  <CreditCard size={18} />
                  Minhas Faturas
                </Link>
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
