import { useState, useEffect } from 'react';
import { Search, Plus, UserCircle, Edit, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Employee } from '../db/db';
import Modal from '../components/Modal';
import { maskCPF, maskPhone, maskCEP, maskDate, fetchAddressByCep } from '../utils/masks';
import { api } from '../services/api';
import './Employees.css';

export default function Employees() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const initialFormState: Partial<Employee> = {
    name: '', role: 'Vendedor', phone: '', cpf: '', email: '', birth_date: '', is_active: true,
    address: { cep: '', street: '', number: '', neighborhood: '', city: '', state: '', observation: '' }
  };
  const [formData, setFormData] = useState<Partial<Employee>>(initialFormState);
  const employees = useLiveQuery(() => db.employees.toArray()) || [];

  const filteredEmployees = employees.filter((e: Employee) => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openEditModal = (employee: Employee) => {
    setFormData(employee);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este funcionário?')) {
      try {
        await api.delete(`/employees/${id}`);
      } catch (err) {
        console.error("Erro ao deletar da API", err);
      }
      await db.employees.delete(id);
    }
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCep = maskCEP(e.target.value);
    setFormData(prev => ({ ...prev, address: { ...prev.address!, cep: newCep } }));
    
    if (newCep.length === 9) {
      const addressData = await fetchAddressByCep(newCep);
      if (addressData) {
        setFormData(prev => ({
          ...prev,
          address: {
            ...prev.address!,
            street: addressData.street || prev.address!.street,
            neighborhood: addressData.neighborhood || prev.address!.neighborhood,
            city: addressData.city || prev.address!.city,
            state: addressData.state || prev.address!.state,
          }
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const employeeData = {
      name: formData.name!,
      cpf: formData.cpf,
      email: formData.email,
      birth_date: formData.birth_date,
      role: formData.role!,
      phone: formData.phone!,
      is_active: formData.is_active ?? true,
      address: formData.address
    };

    if (formData.id) {
      try {
        await api.put(`/employees/${formData.id}`, employeeData);
      } catch (err) {
        console.error("Erro ao sincronizar update na API", err);
      }
      await db.employees.update(formData.id, employeeData);
    } else {
      let insertedId = null;
      try {
        const res = await api.post('/employees', employeeData);
        if (res.data && res.data.id) insertedId = res.data.id;
      } catch (err) {
        console.error("Erro ao sincronizar insert na API", err);
      }
      await db.employees.add({ ...employeeData, id: insertedId || undefined, created_at: new Date() } as Employee);
    }
    
    setIsModalOpen(false);
    setFormData(initialFormState);
  };

  return (
    <div className="employees-container">
      <div className="page-header">
        <h1 className="page-title">Funcionários</h1>
        <button className="btn-primary add-btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} />
          Novo Funcionário
        </button>
      </div>

      <div className="search-filters glass-panel">
        <div className="search-box">
          <Search size={20} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar por nome..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="employees-grid">
        {filteredEmployees.map((employee: Employee) => (
          <div key={employee.id} className={`employee-card glass-panel ${!employee.is_active ? 'inactive' : ''}`}>
            <div className="card-top">
              <div className="employee-info">
                <div className="avatar">
                  <UserCircle size={40} />
                </div>
                <div className="details">
                  <h3>{employee.name}</h3>
                  <p className="role-badge">{employee.role}</p>
                </div>
              </div>
              <div className="status-icon">
                {employee.is_active ? (
                  <div className="badge success" title="Ativo"><ShieldCheck size={18} /></div>
                ) : (
                  <div className="badge danger" title="Inativo"><ShieldAlert size={18} /></div>
                )}
              </div>
            </div>
            
            <div className="contact-info">
              <p>{employee.phone || 'Sem telefone'}</p>
            </div>

            <div className="card-actions">
              <div style={{display: 'flex', gap: '1rem'}}>
                <button className="btn-icon" title="Editar Funcionário" onClick={() => openEditModal(employee)}>
                  <Edit size={18} /> Editar
                </button>
                <button className="btn-icon danger" title="Excluir" onClick={() => employee.id && handleDelete(employee.id)}>
                  <Trash2 size={18} /> Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? 'Editar Funcionário' : 'Novo Funcionário'}>
        <form onSubmit={handleSubmit}>
          <h3 style={{fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)'}}>Dados Pessoais</h3>
          
          <div className="form-group">
            <label>Nome Completo</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>CPF</label>
              <input type="text" placeholder="000.000.000-00" value={formData.cpf} onChange={e => setFormData({...formData, cpf: maskCPF(e.target.value)})} />
            </div>
            <div className="form-group">
              <label>Data de Nascimento</label>
              <input type="text" placeholder="DD/MM/AAAA" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: maskDate(e.target.value)})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Telefone / WhatsApp</label>
              <input type="text" required placeholder="(00) 00000-0000" value={formData.phone} onChange={e => setFormData({...formData, phone: maskPhone(e.target.value)})} />
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input type="email" placeholder="func@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Cargo</label>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="ADMIN" style={{ background: 'var(--bg-panel)' }}>Administrador</option>
                <option value="Gerente" style={{ background: 'var(--bg-panel)' }}>Gerente</option>
                <option value="Vendedor" style={{ background: 'var(--bg-panel)' }}>Vendedor</option>
                <option value="Entregador" style={{ background: 'var(--bg-panel)' }}>Entregador</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={formData.is_active ? 'active' : 'inactive'} onChange={e => setFormData({...formData, is_active: e.target.value === 'active'})}>
                <option value="active" style={{ background: 'var(--bg-panel)' }}>Ativo</option>
                <option value="inactive" style={{ background: 'var(--bg-panel)' }}>Inativo</option>
              </select>
            </div>
          </div>

          <h3 style={{fontSize: '1rem', margin: '1.5rem 0 1rem', color: 'var(--primary)'}}>Endereço</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>CEP</label>
              <input type="text" placeholder="00000-000" value={formData.address?.cep} onChange={handleCepChange} />
            </div>
            <div className="form-group">
              <label>UF</label>
              <input type="text" maxLength={2} placeholder="SP" value={formData.address?.state} onChange={e => setFormData({...formData, address: {...formData.address!, state: e.target.value}})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex: 2}}>
              <label>Rua / Avenida</label>
              <input type="text" value={formData.address?.street} onChange={e => setFormData({...formData, address: {...formData.address!, street: e.target.value}})} />
            </div>
            <div className="form-group">
              <label>Número</label>
              <input type="text" value={formData.address?.number} onChange={e => setFormData({...formData, address: {...formData.address!, number: e.target.value}})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Bairro</label>
              <input type="text" value={formData.address?.neighborhood} onChange={e => setFormData({...formData, address: {...formData.address!, neighborhood: e.target.value}})} />
            </div>
            <div className="form-group">
              <label>Cidade</label>
              <input type="text" value={formData.address?.city} onChange={e => setFormData({...formData, address: {...formData.address!, city: e.target.value}})} />
            </div>
          </div>

          <div className="form-group">
            <label>Observação de Endereço (Opcional)</label>
            <input type="text" placeholder="Ex: Ao lado da padaria" value={formData.address?.observation} onChange={e => setFormData({...formData, address: {...formData.address!, observation: e.target.value}})} />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar Funcionário</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
