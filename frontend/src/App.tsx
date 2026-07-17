import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Pos from './pages/Pos';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import Employees from './pages/Employees';
import Settings from './pages/Settings';
import Receipts from './pages/Receipts';
import Reports from './pages/Reports';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import StockEntries from './pages/StockEntries';
import AdminOrders from './pages/AdminOrders';
import Finances from './pages/Finances';
import Suppliers from './pages/Suppliers';
import { AuthProvider } from './contexts/AuthContext';
import StoreLayout from './components/StoreLayout';
import StoreHome from './pages/StoreHome';
import StoreProfile from './pages/StoreProfile';
import StoreCart from './pages/StoreCart';
import StoreOrders from './pages/StoreOrders';
import StoreInstallments from './pages/StoreInstallments';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function AppLayout() {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

import { CartProvider } from './contexts/CartContext';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Rotas Internas de Gestão */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/funcionarios" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="pos" element={<Pos />} />
              <Route path="receipts" element={<Receipts />} />
              <Route path="customers" element={<Customers />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="stock-entries" element={<StockEntries />} />
              <Route path="finances" element={<Finances />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="funcionarios" element={<Employees />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            {/* Portal do Cliente */}
            <Route path="/loja" element={
              <ProtectedRoute requireCustomer={true}>
                <StoreLayout />
              </ProtectedRoute>
            }>
              <Route index element={<StoreHome />} />
              <Route path="perfil" element={<StoreProfile />} />
              <Route path="carrinho" element={<StoreCart />} />
              <Route path="pedidos" element={<StoreOrders />} />
              <Route path="faturas" element={<StoreInstallments />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
