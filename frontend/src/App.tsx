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
import StockEntries from './pages/StockEntries';
import Finances from './pages/Finances';
import Suppliers from './pages/Suppliers';
import { AuthProvider } from './contexts/AuthContext';
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
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
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
