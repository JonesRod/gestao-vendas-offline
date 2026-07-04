import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Users, Package, Settings, Store, Briefcase, FileText, Receipt, Palette, Moon, Sun, Menu, X, LogOut, ChevronLeft, ChevronRight, PackagePlus, DollarSign, Truck } from 'lucide-react';
import Modal from './Modal';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pos', label: 'Ponto de Venda', icon: ShoppingCart },
  { path: '/receipts', label: 'Receber Conta', icon: Receipt },
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
  }, []);

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
        <button className="menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {isMobileMenuOpen && <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <aside className={`sidebar glass-panel ${isMobileMenuOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header hide-on-mobile">
          <div className="logo-icon">
            <Store size={28} color="#f8fafc" />
          </div>
          {!isCollapsed && <h1 className="logo-text">Gestão<span>Pro</span></h1>}
          <button className="btn-collapse" onClick={toggleCollapse} title={isCollapsed ? "Expandir" : "Recolher"}>
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

      <nav className="sidebar-nav">
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
    </aside>
    </>
  );
}
