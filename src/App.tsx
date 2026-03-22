import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Pos from './pages/Pos';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import Employees from './pages/Employees';
import Settings from './pages/Settings';
import Receipts from './pages/Receipts';
import Reports from './pages/Reports';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/funcionarios" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pos" element={<Pos />} />
            <Route path="/receipts" element={<Receipts />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/funcionarios" element={<Employees />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
