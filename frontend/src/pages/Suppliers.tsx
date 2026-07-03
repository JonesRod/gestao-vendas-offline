import { useState, useEffect } from 'react';
import { Search, Plus, UserX, UserCheck, Edit, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import Modal from '../components/Modal';
import { maskCpfCnpj, maskPhone, maskCEP, fetchAddressByCep } from '../utils/masks';
import './Suppliers.css';

export interface Supplier {
  id: number;
  name: string;
  trade_name?: string;
  cnpj_cpf?: string;
  email?: string;
  phone?: string;
  address?: {
    cep?: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    observation?: string;
  };
  is_active: boolean;
  created_at?: string;
}

export default function Suppliers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const initialFormState: Partial<Supplier> = {
    name: '',
    trade_name: '',
    cnpj_cpf: '',
    email: '',
    phone: '',
    is_active: true,
    address: { cep: '', street: '', number: '', neighborhood: '', city: '', state: '', observation: '' }
  };
  const [formData, setFormData] = useState<Partial<Supplier>>(initialFormState);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const fetchSuppliers = async () => {
    try {
      const { data } = await api.get('/suppliers');
      const formatted = data.map((s: any) => ({
        ...s,
        address: {
          cep: s.cep || '',
          street: s.street || '',
          number: s.number || '',
          neighborhood: s.neighborhood || '',
          city: s.city || '',
          state: s.state || '',
          observation: s.observation || ''
        }
      }));
      setSuppliers(formatted);
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      let finalValue = value;
      if (addressField === 'cep') finalValue = maskCEP(value);
      
      setFormData(prev => ({
        ...prev,
        address: { ...prev.address, [addressField]: finalValue }
      }));

      if (addressField === 'cep' && finalValue.replace(/\D/g, '').length === 8) {
        handleCepLookup(finalValue);
      }
    } else {
      let finalValue = value;
      if (name === 'phone') finalValue = maskPhone(value);
      if (name === 'cnpj_cpf') finalValue = maskCpfCnpj(value);

      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : finalValue
      }));
    }
  };

  const handleCepLookup = async (cep: string) => {
    const address = await fetchAddressByCep(cep);
    if (address) {
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          street: address.logradouro,
          neighborhood: address.bairro,
          city: address.localidade,
          state: address.uf
        }
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        trade_name: formData.trade_name,
        cnpj_cpf: formData.cnpj_cpf,
        email: formData.email,
        phone: formData.phone,
        is_active: formData.is_active,
        cep: formData.address?.cep,
        street: formData.address?.street,
        number: formData.address?.number,
        neighborhood: formData.address?.neighborhood,
        city: formData.address?.city,
        state: formData.address?.state,
        observation: formData.address?.observation
      };

      if (formData.id) {
        await api.put(`/suppliers/${formData.id}`, payload);
      } else {
        await api.post('/suppliers', payload);
      }
      fetchSuppliers();
      setIsModalOpen(false);
      setFormData(initialFormState);
    } catch (error) {
      console.error('Erro ao salvar fornecedor:', error);
      alert('Erro ao salvar fornecedor. Verifique os dados.');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este fornecedor?')) {
      try {
        await api.delete(`/suppliers/${id}`);
        fetchSuppliers();
      } catch (error) {
        console.error('Erro ao excluir fornecedor:', error);
        alert('Erro ao excluir fornecedor.');
      }
    }
  };

  const openEditModal = (supplier: Supplier) => {
    setFormData(supplier);
    setIsModalOpen(true);
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.cnpj_cpf && s.cnpj_cpf.includes(searchTerm)) ||
    (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="suppliers-container">
      <header className="page-header">
        <h1>Fornecedores</h1>
        <button className="btn btn-primary" onClick={() => { setFormData(initialFormState); setIsModalOpen(true); }}>
          <Plus size={20} />
          Novo Fornecedor
        </button>
      </header>

      <div className="filters-section card">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por nome, CPF/CNPJ ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="suppliers-grid">
        {filteredSuppliers.map(supplier => (
          <div key={supplier.id} className={`supplier-card ${!supplier.is_active ? 'inactive' : ''}`}>
            <div className="supplier-header">
              <div>
                <h3>{supplier.name}</h3>
                {supplier.trade_name && <p className="supplier-trade-name">Fantasia: {supplier.trade_name}</p>}
                <p className="supplier-document">{supplier.cnpj_cpf || 'Sem documento'}</p>
              </div>
              <div className="supplier-status">
                {supplier.is_active ? 
                  <span className="badge success"><UserCheck size={14}/> Ativo</span> : 
                  <span className="badge danger"><UserX size={14}/> Inativo</span>
                }
              </div>
            </div>
            
            <div className="supplier-info">
              <p><strong>Telefone:</strong> {supplier.phone || '-'}</p>
              <p><strong>Email:</strong> {supplier.email || '-'}</p>
              <p><strong>Cidade:</strong> {supplier.address?.city ? `${supplier.address.city}/${supplier.address.state}` : '-'}</p>
            </div>

            <div className="supplier-actions">
              <button className="btn-icon" onClick={() => openEditModal(supplier)} title="Editar">
                <Edit size={18} />
              </button>
              <button className="btn-icon danger" onClick={() => handleDelete(supplier.id)} title="Excluir">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {filteredSuppliers.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center' }}>
            <p>Nenhum fornecedor encontrado.</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formData.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}
      >
        <form onSubmit={handleSubmit} className="supplier-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nome Completo / Razão Social *</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Nome Fantasia</label>
              <input type="text" name="trade_name" value={formData.trade_name || ''} onChange={handleInputChange} />
            </div>
          </div>

          <div className="form-row two-cols">
            <div className="form-group">
              <label>CPF/CNPJ</label>
              <input type="text" name="cnpj_cpf" value={formData.cnpj_cpf} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label>Telefone / WhatsApp</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} />
            </div>
          </div>

          <h3 className="form-section-title">Endereço</h3>
          
          <div className="form-row three-cols-address">
            <div className="form-group">
              <label>CEP</label>
              <input type="text" name="address.cep" value={formData.address?.cep} onChange={handleInputChange} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Rua/Logradouro</label>
              <input type="text" name="address.street" value={formData.address?.street} onChange={handleInputChange} />
            </div>
          </div>

          <div className="form-row three-cols-address">
            <div className="form-group">
              <label>Número</label>
              <input type="text" name="address.number" value={formData.address?.number} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label>Bairro</label>
              <input type="text" name="address.neighborhood" value={formData.address?.neighborhood} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label>Cidade</label>
              <input type="text" name="address.city" value={formData.address?.city} onChange={handleInputChange} />
            </div>
          </div>

          <div className="form-row two-cols">
            <div className="form-group">
              <label>Estado (UF)</label>
              <input type="text" name="address.state" value={formData.address?.state} onChange={handleInputChange} maxLength={2} />
            </div>
            <div className="form-group">
              <label>Complemento/Observação</label>
              <input type="text" name="address.observation" value={formData.address?.observation} onChange={handleInputChange} />
            </div>
          </div>

          <div className="form-row">
            <label className="checkbox-label">
              <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleInputChange} />
              Fornecedor Ativo
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
