import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  role: string | null;
  user: any | null;
  login: (cpf: string, password: string, role: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('@GestaoOffline:token');
  });
  
  const [role, setRole] = useState<string | null>(() => {
    return localStorage.getItem('@GestaoOffline:role');
  });

  const [user, setUser] = useState<any | null>(() => {
    const u = localStorage.getItem('@GestaoOffline:user');
    return u ? JSON.parse(u) : null;
  });

  const login = async (cpf: string, password: string, selectedRole: string) => {
    try {
      const response = await api.post('/auth/login', { cpf, password, role: selectedRole });
      
      if (response.data.token) {
        setIsAuthenticated(true);
        setRole(response.data.role);
        setUser(response.data.user);
        
        localStorage.setItem('@GestaoOffline:token', response.data.token);
        localStorage.setItem('@GestaoOffline:role', response.data.role);
        if (response.data.user) {
          localStorage.setItem('@GestaoOffline:user', JSON.stringify(response.data.user));
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed", error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setRole(null);
    setUser(null);
    localStorage.removeItem('@GestaoOffline:token');
    localStorage.removeItem('@GestaoOffline:role');
    localStorage.removeItem('@GestaoOffline:user');
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
