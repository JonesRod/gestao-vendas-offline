import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Users, Package, Settings, Store, Briefcase, FileText, Receipt, Palette, Moon, Sun, Menu, X, LogOut, ChevronLeft, ChevronRight, PackagePlus, DollarSign, Truck, ShoppingBag, Bell } from 'lucide-react';
import Modal from './Modal';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import './Sidebar.css';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pos', label: 'Ponto de Venda', icon: ShoppingCart },
  { path: '/receipts', label: 'Receber Conta', icon: Receipt },
  { path: '/orders', label: 'Pedidos', icon: ShoppingBag },
  { path: '/customers', label: 'Clientes', icon: Users },
  { path: '/inventory', label: 'Produtos', icon: Package },
  { path: '/stock-entries', label: 'Entrada de Estoque', icon: PackagePlus },
  { path: '/suppliers', label: 'Fornecedores', icon: Truck },
  { path: '/finances', label: 'Finanças', icon: DollarSign },
  { path: '/funcionarios', label: 'Funcionários', icon: Briefcase },
  { path: '/reports', label: 'Relatórios', icon: FileText },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

export default function Sidebar() {
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [theme, setTheme] = useState<'dark'|'light'>('dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const { logout, user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark'|'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') {
         document.documentElement.setAttribute('data-theme', 'light');
      } else {
         document.documentElement.removeAttribute('data-theme');
      }
    }
    
    const savedCollapsed = localStorage.getItem('sidebar_collapsed');
    if (savedCollapsed === 'true') {
      setIsCollapsed(true);
    }

    const fetchNotifs = async () => {
      try {
        const [salesRes, instRes] = await Promise.all([
          api.get('/sales'),
          api.get('/installments')
        ]);
        const pendingSales = salesRes.data.filter((s:any) => s.status === 'pending');
        const overdueInsts = instRes.data.filter((i:any) => i.status === 'pending' && new Date(i.due_date) < new Date());
        
        const dismissed = JSON.parse(localStorage.getItem('dismissedNotifs') || '{}');
        
        const newNotifs = [];
        if (pendingSales.length > 0 && dismissed.pendingSales !== pendingSales.length) {
           newNotifs.push({ id: 'sales', count: pendingSales.length, type: 'warning', text: `${pendingSales.length} pedido(s) pendente(s).` });
        }
        if (overdueInsts.length > 0 && dismissed.overdueInsts !== overdueInsts.length) {
           newNotifs.push({ id: 'insts', count: overdueInsts.length, type: 'danger', text: `${overdueInsts.length} pagamento(s) atrasado(s).` });
        }
        setNotifications(newNotifs);
      } catch (e) {
        console.error(e);
      }
    };
    
    if (role === 'ADMIN' || role === 'EMPLOYEE') {
      fetchNotifs();
      const interval = setInterval(fetchNotifs, 30000);
      return () => clearInterval(interval);
    }
  }, [role]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    localStorage.setItem('sidebar_collapsed', (!isCollapsed).toString());
  };

  const changeTheme = (newTheme: 'dark'|'light') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    setIsThemeModalOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="logo-icon" style={{ padding: '6px' }}>
            <Store size={22} color="#f8fafc" />
          </div>
          <h1 className="logo-text" style={{ fontSize: '1.25rem', margin: 0 }}>Gestão<span>Pro</span></h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {role !== 'CUSTOMER' && (
            <button className="menu-toggle" style={{ position: 'relative' }} onClick={() => setIsNotifModalOpen(true)}>
              <Bell size={24} />
              {notifications.length > 0 && <span style={{ position: 'absolute', top: 4, right: 4, width: 10, height: 10, background: 'var(--danger)', borderRadius: '50%' }}></span>}
            </button>
          )}
          <button className="menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <aside className={`sidebar glass-panel ${isMobileMenuOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header hide-on-mobile">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="logo-icon">
              <Store size={28} color="#f8fafc" />
            </div>
            {!isCollapsed && <h1 className="logo-text">Gestão<span>Pro</span></h1>}
          </div>

          <button className="btn-collapse" onClick={toggleCollapse} title={isCollapsed ? "Expandir" : "Recolher"}>
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

      <nav className="sidebar-nav">
        {role !== 'CUSTOMER' && (
          <button 
            className="nav-item"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none', width: '100%', textAlign: 'left', padding: '12px 16px' }}
            title={isCollapsed ? "Notificações" : undefined}
            onClick={() => {
              setIsNotifModalOpen(true);
              setIsMobileMenuOpen(false);
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} className="nav-icon" style={{ margin: 0 }} />
              {notifications.length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, background: 'var(--danger)', borderRadius: '50%' }}></span>}
            </div>
            {!isCollapsed && (
              <span className="nav-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1, paddingRight: '0.5rem', fontWeight: 500 }}>
                Notificações
                {notifications.length > 0 && (
                  <span style={{ background: 'var(--danger)', color: 'white', fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '12px', fontWeight: 'bold' }}>
                    {notifications.length}
                  </span>
                )}
              </span>
            )}
          </button>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
                title={isCollapsed ? item.label : undefined}
              >
              <Icon size={20} className="nav-icon" />
              {!isCollapsed && <span className="nav-label">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: 'auto' }}>
        <button onClick={() => setIsThemeModalOpen(true)} className="nav-item" style={{ background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none', width: '100%', display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', padding: '0.6rem 0.8rem' }} title={isCollapsed ? "Aparência" : undefined}>
           <Palette size={20} className="nav-icon" />
           {!isCollapsed && <span className="nav-label" style={{ fontWeight: 500 }}>Aparência</span>}
        </button>
        
        <button onClick={handleLogout} className="nav-item" style={{ background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none', width: '100%', display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--danger)', marginBottom: '1rem', padding: '0.6rem 0.8rem' }} title={isCollapsed ? "Sair" : undefined}>
           <LogOut size={20} className="nav-icon" style={{ color: 'var(--danger)' }} />
           {!isCollapsed && <span className="nav-label" style={{ fontWeight: 500 }}>Sair</span>}
        </button>

        <div className={`user-profile ${isCollapsed ? 'collapsed' : ''}`} title={isCollapsed ? (user?.name || "Usuário") : undefined}>
          <div className="avatar">{user?.name ? user.name.substring(0,2).toUpperCase() : "US"}</div>
          {!isCollapsed && (
            <div className="user-info">
              <p className="user-name">{user?.name || "Usuário"}</p>
              <p className="user-role">{role === 'ADMIN' ? 'Administrador' : role === 'EMPLOYEE' ? 'Funcionário' : 'Cliente'}</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} title="Preferências de Aparência">
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr', padding: '1rem 0' }}>
          
          <button 
             onClick={() => changeTheme('dark')}
             style={{ 
               background: theme === 'dark' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-panel)',
               border: `2px solid ${theme === 'dark' ? 'var(--primary)' : 'var(--border-color)'}`,
               borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column',
               alignItems: 'center', gap: '1rem', cursor: 'pointer', color: 'var(--text-main)',
               transition: 'all 0.2s ease'
             }}
          >
            <Moon size={32} color={theme === 'dark' ? 'var(--primary)' : 'var(--text-muted)'} />
            <span style={{ fontWeight: 600 }}>Modo Escuro</span>
          </button>
          
          <button 
             onClick={() => changeTheme('light')}
             style={{ 
               background: theme === 'light' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-panel)',
               border: `2px solid ${theme === 'light' ? 'var(--primary)' : 'var(--border-color)'}`,
               borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column',
               alignItems: 'center', gap: '1rem', cursor: 'pointer', color: 'var(--text-main)',
               transition: 'all 0.2s ease'
             }}
          >
            <Sun size={32} color={theme === 'light' ? 'var(--primary)' : 'var(--text-muted)'} />
            <span style={{ fontWeight: 600 }}>Modo Claro</span>
          </button>
          
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          O tema escolhido é injetado globalmente e persisitido no seu dispositivo para consultas futuras sem piscar!
        </p>
      </Modal>

      <Modal isOpen={isNotifModalOpen} onClose={() => setIsNotifModalOpen(false)} title="Notificações do Sistema">
        <div style={{ padding: '1rem 0' }}>
          {notifications.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma notificação no momento.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {notifications.map(n => (
                <div 
                  key={n.id} 
                  style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', borderLeft: `4px solid var(--${n.type})`, cursor: 'pointer', transition: 'background 0.2s' }}
                  onClick={() => {
                    setIsNotifModalOpen(false);
                    const dismissed = JSON.parse(localStorage.getItem('dismissedNotifs') || '{}');
                    if (n.id === 'sales') {
                      dismissed.pendingSales = n.count;
                      localStorage.setItem('dismissedNotifs', JSON.stringify(dismissed));
                      setNotifications(prev => prev.filter(x => x.id !== 'sales'));
                      navigate('/orders?highlight=pending');
                    }
                    if (n.id === 'insts') {
                      dismissed.overdueInsts = n.count;
                      localStorage.setItem('dismissedNotifs', JSON.stringify(dismissed));
                      setNotifications(prev => prev.filter(x => x.id !== 'insts'));
                      navigate('/receipts?highlight=overdue');
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
    </aside>
    </>
  );
}
