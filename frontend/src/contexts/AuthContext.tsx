import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  role: string | null;
  user: any | null;
  login: (cpf: string, password: string, role?: string) => Promise<{ success: boolean; requireRoleSelection?: boolean; availableRoles?: string[]; role?: string; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Verifica se o token JWT ainda é válido (não expirou)
function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp é em segundos, Date.now() em ms
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function clearAuthStorage() {
  localStorage.removeItem('@GestaoOffline:token');
  localStorage.removeItem('@GestaoOffline:role');
  localStorage.removeItem('@GestaoOffline:user');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const token = localStorage.getItem('@GestaoOffline:token');
    if (!isTokenValid(token)) {
      clearAuthStorage();
      return false;
    }
    return true;
  });
  
  const [role, setRole] = useState<string | null>(() => {
    const token = localStorage.getItem('@GestaoOffline:token');
    if (!isTokenValid(token)) return null;
    return localStorage.getItem('@GestaoOffline:role');
  });

  const [user, setUser] = useState<any | null>(() => {
    const token = localStorage.getItem('@GestaoOffline:token');
    if (!isTokenValid(token)) return null;
    const u = localStorage.getItem('@GestaoOffline:user');
    return u ? JSON.parse(u) : null;
  });

  // Sincroniza logout entre abas diferentes do navegador
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === '@GestaoOffline:token' && !e.newValue) {
        setIsAuthenticated(false);
        setRole(null);
        setUser(null);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = async (cpf: string, password: string, role?: string) => {
    try {
      const response = await api.post('/auth/login', { cpf, password, role });
      
      if (response.data.requireRoleSelection) {
        return { success: true, requireRoleSelection: true, availableRoles: response.data.availableRoles };
      }

      const { token, role: userRole, user: userData } = response.data;
      
      localStorage.setItem('@GestaoOffline:token', token);
      localStorage.setItem('@GestaoOffline:role', userRole);
      
      if (userData) {
        localStorage.setItem('@GestaoOffline:user', JSON.stringify(userData));
      }

      setRole(userRole);
      setUser(userData);
      setIsAuthenticated(true);
      
      return { success: true, role: userRole };
    } catch (error) {
      console.error("Login failed", error);
      return { success: false };
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setRole(null);
    setUser(null);
    clearAuthStorage();
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
