import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Package, ClipboardList, CreditCard, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { api } from '../services/api';
import Modal from './Modal';
import './StoreLayout.css';

export default function StoreLayout() {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const fetchNotifs = async () => {
      if (!user) return;
      try {
        const [salesRes, instRes] = await Promise.all([
          api.get(`/sales?customerId=${user.id}`),
          api.get(`/installments?customerId=${user.id}`)
        ]);
        
        const pendingSales = salesRes.data.filter((s:any) => s.status === 'pending');
        const overdueInsts = instRes.data.filter((i:any) => i.status === 'pending' && new Date(i.due_date) < new Date());
        
        const dismissed = JSON.parse(localStorage.getItem('dismissedNotifsStore') || '{}');

        const newNotifs = [];
        if (pendingSales.length > 0 && dismissed.pendingSales !== pendingSales.length) {
           newNotifs.push({ id: 'sales', count: pendingSales.length, type: 'info', text: `Você tem ${pendingSales.length} pedido(s) em andamento.` });
        }
        if (overdueInsts.length > 0 && dismissed.overdueInsts !== overdueInsts.length) {
           newNotifs.push({ id: 'insts', count: overdueInsts.length, type: 'danger', text: `Você possui ${overdueInsts.length} fatura(s) vencida(s).` });
        }
        setNotifications(newNotifs);
      } catch (e) {
        console.error(e);
      }
    };
    
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user]);

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
            <button className="cart-btn" title="Notificações" style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }} onClick={() => setIsNotifModalOpen(true)}>
              <Bell size={24} />
              {notifications.length > 0 && <span className="cart-badge" style={{ background: 'var(--danger)', width: 10, height: 10, padding: 0, minWidth: 10, top: 4, right: 4 }}></span>}
            </button>
            
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

      <Modal isOpen={isNotifModalOpen} onClose={() => setIsNotifModalOpen(false)} title="Notificações">
        <div style={{ padding: '1rem 0' }}>
          {notifications.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Você não tem notificações no momento.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {notifications.map(n => (
                <div 
                  key={n.id} 
                  style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', borderLeft: `4px solid var(--${n.type})`, cursor: 'pointer', transition: 'background 0.2s' }}
                  onClick={() => {
                    setIsNotifModalOpen(false);
                    const dismissed = JSON.parse(localStorage.getItem('dismissedNotifsStore') || '{}');
                    if (n.id === 'sales') {
                      dismissed.pendingSales = n.count;
                      localStorage.setItem('dismissedNotifsStore', JSON.stringify(dismissed));
                      setNotifications(prev => prev.filter(x => x.id !== 'sales'));
                      navigate('/loja/pedidos?highlight=pending');
                    }
                    if (n.id === 'insts') {
                      dismissed.overdueInsts = n.count;
                      localStorage.setItem('dismissedNotifsStore', JSON.stringify(dismissed));
                      setNotifications(prev => prev.filter(x => x.id !== 'insts'));
                      navigate('/loja/faturas?highlight=overdue');
                    }
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  <p style={{ margin: 0, color: 'var(--text-main)' }}>{n.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
