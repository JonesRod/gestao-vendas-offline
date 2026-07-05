import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireCustomer?: boolean;
}

export default function ProtectedRoute({ children, requireCustomer }: ProtectedRouteProps) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireCustomer && role !== 'CUSTOMER' && role !== 'customer') {
    return <Navigate to="/dashboard" replace />;
  }
  if (!requireCustomer && (role === 'CUSTOMER' || role === 'customer')) {
    return <Navigate to="/loja" replace />;
  }

  return <>{children}</>;
}
