import { useState, useEffect } from 'react';
import { Search, Plus, Minus, Package, Edit, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { api } from '../services/api';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product } from '../db/db';
import Modal from '../components/Modal';
import { maskCurrency, parseCurrency } from '../utils/masks';
import './Inventory.css';

export default function Inventory() {
  const settingsData = useLiveQuery(() => db.settings.get(1));
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [kitAvailableSearch, setKitAvailableSearch] = useState('');
  const [kitSelectedSearch, setKitSelectedSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [modalType, setModalType] = useState<'product' | 'kit'>('product');
  
  const initialFormState: Partial<Product> = {
    name: '', description: '', cost: 0, margin_cash: 0, margin_credit: 0, price_cash: 0, price_credit: 0, stock: 0, is_active: true, images: [], type: 'product', allow_credit: true, credit_type: 'fixed', credit_interest_rate: 0, max_installments: 1, punctuality_discount_active: false, punctuality_discount_percent: 0, punctuality_discount_value: 0, loyalty_discount_active: false, loyalty_discount_percent: 0, loyalty_discount_value: 0, is_promotional: false, promo_price_cash: 0, promo_price_credit: 0, promo_start_date: '', promo_end_date: ''
  };
  const [formData, setFormData] = useState<Partial<Product>>(initialFormState);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{id: number; name: string}[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/products');
      setProducts(data);
    } catch (error) {
      console.error("Erro ao buscar produtos", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data);
    } catch (error) {
      console.error("Erro ao buscar categorias", error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const openModal = (type: 'product' | 'kit') => {
    setKitAvailableSearch('');
    setKitSelectedSearch('');
    setModalType(type);
    setFormData({ ...initialFormState, type });
    setIsModalOpen(true);
  };
  
  const kitItemIds = new Set((formData.kit_items || []).map(i => i.productId));
  const availableProducts = products
    .filter(p => p.type === 'product' && p.is_active !== false && p.id != null && !kitItemIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));
    
  const filteredAvailableProducts = availableProducts.filter(p => p.name.toLowerCase().includes(kitAvailableSearch.toLowerCase()));

  const addKitItem = (product: Product) => {
    const currentItems = formData.kit_items || [];
    const existing = currentItems.find(i => i.productId === product.id);
    if (existing) {
      updateKitItem(product.id!, existing.quantity + 1);
    } else {
      setFormData(prev => ({
        ...prev,
        kit_items: [...currentItems, { productId: product.id!, quantity: 1 }]
      }));
    }
  };

  const removeKitItem = (productId: number) => {
    setFormData(prev => ({
      ...prev,
      kit_items: prev.kit_items?.filter(i => i.productId !== productId)
    }));
  };

  const updateKitItem = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeKitItem(productId);
      return;
    }
    setFormData(prev => ({
      ...prev,
      kit_items: prev.kit_items?.map(i => i.productId === productId ? { ...i, quantity } : i)
    }));
  };

  const kitItemsWithDetails = (formData.kit_items || []).map(item => {
    const product = products.find(p => p.id === item.productId);
    return { ...item, product };
  }).filter(item => item.product);

  const kitTotalCash = kitItemsWithDetails.reduce((sum, item) => sum + ((item.product?.price_cash || 0) * item.quantity), 0);
  const kitTotalCredit = kitItemsWithDetails.reduce((sum, item) => sum + ((item.product?.price_credit || 0) * item.quantity), 0);
  const kitTotalCost = kitItemsWithDetails.reduce((sum, item) => sum + ((item.product?.cost || 0) * item.quantity), 0);
  
  const kitAvailableStock = kitItemsWithDetails.length > 0
    ? Math.min(...kitItemsWithDetails.map(item => Number(item.product?.stock) || 0))
    : 0;
    
  const filteredKitItems = kitItemsWithDetails.filter(i => i.product!.name.toLowerCase().includes(kitSelectedSearch.toLowerCase()));

  const openEditModal = (product: Product) => {
    setKitAvailableSearch('');
    setKitSelectedSearch('');
    setModalType(product.type);
    setFormData(product);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId !== null) {
      try {
        await api.delete(`/products/${deleteConfirmId}`);
        fetchProducts();
      } catch (error) {
        console.error("Erro ao excluir produto", error);
      } finally {
        setDeleteConfirmId(null);
      }
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmId(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const currentImages = formData.images || [];
    const remainingSlots = 5 - currentImages.length;
    const filesToProcess = files.slice(0, remainingSlots);

    const promises = filesToProcess.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(base64Images => {
      setFormData(prev => ({ ...prev, images: [...(prev.images || []), ...base64Images] }));
    });
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await api.post('/categories', { name: newCategoryName });
      setNewCategoryName('');
      fetchCategories();
    } catch (error) {
      console.error("Erro ao adicionar categoria", error);
    }
  };

  const handleEditCategory = async (id: number) => {
    if (!editingCategoryName.trim()) return;
    try {
      await api.put(`/categories/${id}`, { name: editingCategoryName });
      setEditingCategoryId(null);
      setEditingCategoryName('');
      fetchCategories();
    } catch (error) {
      console.error("Erro ao editar categoria", error);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (error) {
      console.error("Erro ao excluir categoria", error);
    }
  };


  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images?.filter((_, i) => i !== index)
    }));
  };

  const handleCostChange = (costInput: string) => {
    const cost = parseCurrency(costInput);
    setFormData(prev => {
      const price_cash = cost * (1 + (prev.margin_cash || 0)/100);
      const price_credit = cost * (1 + (prev.margin_credit || 0)/100);
      return { ...prev, cost, price_cash, price_credit };
    });
  };

  const handleMarginChange = (type: 'cash' | 'credit', marginInput: string) => {
    const margin = parseCurrency(marginInput);
    setFormData(prev => {
      const cost = prev.cost || 0;
      if (type === 'cash') {
        const price_cash = cost * (1 + margin / 100);
        return { ...prev, margin_cash: margin, price_cash };
      } else {
        const price_credit = cost * (1 + margin / 100);
        return { ...prev, margin_credit: margin, price_credit };
      }
    });
  };

  const handlePriceChange = (type: 'cash' | 'credit', priceInput: string) => {
    const price = parseCurrency(priceInput);
    setFormData(prev => {
      const cost = prev.cost || 0;
      if (type === 'cash') {
        const margin_cash = cost ? ((price / cost) - 1) * 100 : 0;
        return { ...prev, price_cash: price, margin_cash };
      } else {
        const margin_credit = cost ? ((price / cost) - 1) * 100 : 0;
        return { ...prev, price_credit: price, margin_credit };
      }
    });
  };

  const handlePromoPriceChange = (type: 'cash' | 'credit', priceInput: string) => {
    const price = parseCurrency(priceInput);
    setFormData(prev => ({
      ...prev,
      [type === 'cash' ? 'promo_price_cash' : 'promo_price_credit']: price
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalCategoryId = formData.categoryId || null;
    if (modalType === 'kit') {
      let kitCategory = categories.find(c => c.name.toLowerCase() === 'kit' || c.name.toLowerCase() === 'kits');
      if (!kitCategory) {
        try {
          const { data } = await api.post('/categories', { name: 'Kits' });
          kitCategory = data;
          fetchCategories();
        } catch (error) {
          console.error("Erro ao criar categoria Kits", error);
        }
      }
      finalCategoryId = kitCategory ? kitCategory.id : null;
    }

    const productData = {
      name: formData.name!,
      description: formData.description,
      categoryId: finalCategoryId,
      cost: modalType === 'kit' ? kitItemsWithDetails.reduce((sum, i) => sum + ((i.product?.cost || 0) * i.quantity), 0) : (Number(formData.cost) || 0),
      margin_cash: modalType === 'kit' ? 0 : (Number(formData.margin_cash) || 0),
      margin_credit: modalType === 'kit' ? 0 : (Number(formData.margin_credit) || 0),
      price_cash: modalType === 'kit' ? kitTotalCash : (Number(formData.price_cash) || 0),
      price_credit: modalType === 'kit' ? kitTotalCredit : (Number(formData.price_credit) || 0),
      stock: modalType === 'kit' ? kitAvailableStock : (Number(formData.stock) || 0),
      is_active: formData.is_active ?? true,
      images: formData.images || [],
      type: modalType,
      kit_items: modalType === 'kit' ? formData.kit_items || [] : [],
      allow_credit: formData.allow_credit !== false,
      credit_type: formData.credit_type || 'fixed',
      credit_interest_rate: Number(formData.credit_interest_rate) || 0,
      max_installments: Number(formData.max_installments) || 1,
      punctuality_discount_active: formData.punctuality_discount_active || false,
      punctuality_discount_percent: Number(formData.punctuality_discount_percent) || 0,
      punctuality_discount_value: Number(formData.punctuality_discount_value) || 0,
      loyalty_discount_active: formData.loyalty_discount_active || false,
      loyalty_discount_percent: Number(formData.loyalty_discount_percent) || 0,
      loyalty_discount_value: Number(formData.loyalty_discount_value) || 0,
      is_promotional: formData.is_promotional || false,
      promo_price_cash: Number(formData.promo_price_cash) || 0,
      promo_price_credit: Number(formData.promo_price_credit) || 0,
      promo_start_date: formData.promo_start_date || null,
      promo_end_date: formData.promo_end_date || null
    };

    try {
      if (formData.id) {
        await api.put(`/products/${formData.id}`, productData);
      } else {
        await api.post('/products', productData);
      }
      setIsModalOpen(false);
      setFormData(initialFormState);
      fetchProducts();
    } catch (error) {
      console.error("Erro ao salvar produto", error);
    }
  };

  const filteredProducts = products.filter((p: Product) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'kits') return p.type === 'kit';
    if (filter === 'avulsos') return p.type === 'product';
    if (filter === 'low') return p.stock <= 10;
    if (filter === 'promo') return p.is_promotional === true;
    if (filter.startsWith('cat_')) {
      const catId = Number(filter.split('_')[1]);
      return p.categoryId === catId;
    }
    return true;
  });

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1 className="page-title">Produtos</h1>
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '400px' }}>
          <button className="btn-primary add-btn" style={{ flex: 1, justifyContent: 'center', padding: '0.75rem 0.5rem' }} onClick={() => openModal('product')}>
            <Plus size={18} />
            Novo Produto
          </button>
          <button className="btn-primary add-btn" style={{ background: 'var(--success)', flex: 1, justifyContent: 'center', padding: '0.75rem 0.5rem' }} onClick={() => openModal('kit')}>
            <Plus size={18} />
            Novo Kit
          </button>
        </div>
      </div>

      <div className="search-filters glass-panel">
        <div className="search-box">
          <Search size={20} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar por nome do produto..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-pills">
          <button className={`pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todos</button>
          <button className={`pill ${filter === 'kits' ? 'active' : ''}`} onClick={() => setFilter('kits')}>Cestas (Kits)</button>
          <button className={`pill ${filter === 'avulsos' ? 'active' : ''}`} onClick={() => setFilter('avulsos')}>Avulsos</button>
          <button className={`pill ${filter === 'promo' ? 'active' : ''}`} style={filter === 'promo' ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' } : {}} onClick={() => setFilter('promo')}>Em Promoção</button>
          <button className={`pill danger ${filter === 'low' ? 'active' : ''}`} onClick={() => setFilter('low')}>Estoque Baixo</button>
          {categories.map(cat => (
            <button key={`cat_${cat.id}`} className={`pill ${filter === `cat_${cat.id}` ? 'active' : ''}`} onClick={() => setFilter(`cat_${cat.id}`)}>{cat.name}</button>
          ))}
        </div>
      </div>

      <div className="inventory-grid">
        {filteredProducts.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
            <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Nenhum produto encontrado</h3>
            <p style={{ color: 'var(--text-muted)' }}>Não existem produtos cadastrados para esta categoria ou filtro.</p>
          </div>
        ) : (
          filteredProducts.map((product: Product) => {
          const isLowStock = product.stock <= 10;
          const mainImage = product.images?.[0];
          
          return (
            <div key={product.id} className={`inventory-card glass-panel ${isLowStock ? 'low-stock' : ''} ${product.is_active === false ? 'inactive-card' : ''}`}>
              <div className="card-top">
                <div className="inventory-info" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {mainImage ? (
                    <img src={mainImage} alt={product.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px' }} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                      <Package size={20} className={isLowStock ? 'text-danger' : 'text-primary'} />
                    </div>
                  )}
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <div className="type-badge">{product.type === 'kit' ? 'Cesta / Kit' : 'Produto Avulso'}</div>
                      {product.is_promotional && (
                        <div className="type-badge" style={{ background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }}>
                          Promoção
                        </div>
                      )}
                    </div>
                    <h3 style={{fontSize: '1.05rem', margin: '0.2rem 0 0 0'}}>{product.name}</h3>
                  </div>
                </div>
                <div className="stock-level">
                  <span className={`stock-count ${isLowStock ? 'text-danger' : 'text-success'}`}>
                    {product.stock} un
                  </span>
                </div>
              </div>

              <div className="price-section">
                <div className="price-group">
                  <span className="price-label">Din/Pix</span>
                  <span className="price-value">R$ {product.price_cash.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div className="price-group">
                  <span className="price-label">Prazo/Crédito</span>
                  <span className="price-value credit">
                    {(() => {
                      if (product.credit_type === 'interest') {
                        const maxInst = product.max_installments || 1;
                        const basePrice = product.price_cash;
                        const interest = basePrice * ((product.credit_interest_rate || 0) / 100) * maxInst;
                        const instValue = (basePrice + interest) / maxInst;
                        return `${maxInst}x de R$ ${instValue.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                      }
                      return `R$ ${product.price_credit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                    })()}
                  </span>
                </div>
              </div>

              <div className="card-actions">
                <button className="btn-icon" title="Editar Produto" onClick={() => openEditModal(product)}>
                  <Edit size={18} /> Editar
                </button>
                <button className="btn-icon danger" title="Excluir" onClick={() => product.id && handleDelete(product.id)}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          );
        }))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? (modalType === 'product' ? 'Editar Produto' : 'Editar Kit') : (modalType === 'product' ? 'Novo Produto' : 'Novo Kit')} size={modalType === 'kit' ? 'large' : 'default'}>
        <form onSubmit={handleSubmit}>
          
          <div className="form-group images-upload-container">
            <label>Imagens do Produto (até 5)</label>
            
            {(!formData.images || formData.images.length === 0) ? (
              <label className="upload-btn empty-state">
                <ImageIcon size={32} />
                <span>Clique para adicionar imagens</span>
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
              </label>
            ) : (
              <div className="images-gallery">
                <div className="main-image-preview">
                  <img src={formData.images[0]} alt="Capa" />
                  <div className="main-image-badge">Capa</div>
                  <button type="button" className="remove-image-btn" onClick={() => removeImage(0)}>
                    <X size={16} />
                  </button>
                </div>
                <div className="secondary-images-row">
                  {formData.images.slice(1).map((img, index) => (
                    <div key={index + 1} className="image-thumbnail">
                      <img src={img} alt={`Preview ${index + 1}`} />
                      <button type="button" className="remove-image-btn" onClick={() => removeImage(index + 1)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {formData.images.length < 5 && (
                    <label className="upload-btn small">
                      <ImageIcon size={20} />
                      <span>Fotos</span>
                      <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Nome {modalType === 'product' ? 'do Produto' : 'do Kit'}</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>

          <div className="form-group">
            <label>Descrição</label>
            <textarea rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>

          {modalType === 'product' && (
            <div className="form-group">
              <label>Categoria</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select 
                  value={formData.categoryId || ''} 
                  onChange={e => setFormData({...formData, categoryId: e.target.value ? Number(e.target.value) : undefined})}
                  style={{ flex: 1 }}
                >
                  <option value="">Selecione uma categoria...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <button 
                  type="button" 
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="btn-icon"
                  style={{ padding: '0.6rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderRadius: '8px' }}
                  title="Gerenciar Categorias"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          )}

          {modalType === 'kit' && (
            <div className="kit-builder-section">
              <h3 style={{fontSize: '1rem', color: 'var(--primary)', marginBottom: '1rem'}}>Montagem do Kit</h3>
              <div className="kit-builder-grid">
                <div className="kit-available-products">
                  <h4>Produtos Ativos</h4>
                  <div className="search-box" style={{marginBottom: '0.5rem', padding: '0.5rem 0.75rem'}}>
                    <Search size={16} className="search-icon" />
                    <input 
                      type="text" 
                      placeholder="Buscar produto ativo..." 
                      value={kitAvailableSearch}
                      onChange={e => setKitAvailableSearch(e.target.value)}
                      style={{fontSize: '0.85rem'}}
                    />
                  </div>
                  <div className="kit-product-list">
                    {filteredAvailableProducts.map(p => (
                      <div key={p.id} className="kit-product-item" onClick={() => addKitItem(p)}>
                        <span style={{fontSize: '0.85rem', flex: 1}}>{p.name}</span>
                        <span className="kit-price">R$ {p.price_cash.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        <Plus size={14} style={{marginLeft: '8px'}} />
                      </div>
                    ))}
                    {filteredAvailableProducts.length === 0 && (
                      <p style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Nenhum produto avulso encontrado.</p>
                    )}
                  </div>
                </div>

                <div className="kit-selected-products">
                  <h4>Itens Selecionados</h4>
                  <div className="search-box" style={{marginBottom: '0.5rem', padding: '0.5rem 0.75rem'}}>
                    <Search size={16} className="search-icon" />
                    <input 
                      type="text" 
                      placeholder="Buscar no kit..." 
                      value={kitSelectedSearch}
                      onChange={e => setKitSelectedSearch(e.target.value)}
                      style={{fontSize: '0.85rem'}}
                    />
                  </div>
                  <div className="kit-product-list">
                    {filteredKitItems.map(item => (
                      <div key={item.productId} className="kit-selected-item">
                        <div className="kit-selected-header">
                          <h5>{item.product!.name}</h5>
                          <div className="kit-selected-controls">
                            <button type="button" className="kit-qty-btn" onClick={() => updateKitItem(item.productId, item.quantity - 1)}><Minus size={14} /></button>
                            <span style={{fontSize: '0.9rem', width: '20px', textAlign: 'center'}}>{item.quantity}</span>
                            <button type="button" className="kit-qty-btn" onClick={() => updateKitItem(item.productId, item.quantity + 1)}><Plus size={14} /></button>
                          </div>
                        </div>
                        <div className="kit-item-prices">
                          <div><span style={{color: 'var(--text-muted)'}}>UN: Din R$ {item.product!.price_cash.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} | Prz R$ {item.product!.price_credit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
                          <div><span style={{color: 'var(--text-main)'}}>Total: <strong>Din R$ {(item.product!.price_cash * item.quantity).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} | Prz R$ {(item.product!.price_credit * item.quantity).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></span></div>
                        </div>
                      </div>
                    ))}
                    {filteredKitItems.length === 0 && (
                      <p style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Nenhum item adicionado à cesta ainda.</p>
                    )}
                  </div>
                  <div className="kit-summary">
                    <div><span>Custo Ref.</span><strong>R$ {kitTotalCost.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></div>
                    <div><span>Soma à Vista (Cesta)</span><strong>R$ {kitTotalCash.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></div>
                    <div style={{alignItems: 'flex-end'}}><span>Soma a Prazo (Cesta)</span><strong>R$ {kitTotalCredit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group" style={{ flex: modalType === 'kit' ? '1' : 'unset' }}>
              <label>Quantidade em Estoque {modalType === 'kit' ? '(Capacidade Máxima)' : ''}</label>
              <input type="number" min="0" required value={modalType === 'kit' ? kitAvailableStock : formData.stock} readOnly={modalType === 'kit'} style={{ backgroundColor: modalType === 'kit' ? 'rgba(255,255,255,0.05)' : '' }} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
            </div>
            {modalType === 'product' && (
              <div className="form-group">
                <label>Custo Base (R$)</label>
                <input type="text" required value={maskCurrency(formData.cost || 0)} onChange={e => handleCostChange(e.target.value)} />
              </div>
            )}
          </div>

          {modalType === 'product' && (
            <>
              <h3 style={{fontSize: '1rem', margin: '1rem 0', color: 'var(--primary)'}}>Precificação</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Margem à Vista (%)</label>
                  <input type="text" value={maskCurrency(formData.margin_cash || 0)} onChange={e => handleMarginChange('cash', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Preço à Vista / Pix (R$)</label>
                  <input type="text" required value={maskCurrency(formData.price_cash || 0)} onChange={e => handlePriceChange('cash', e.target.value)} />
                </div>
              </div>



              {/* Seção de Promoção em Destaque */}
              <div style={{ marginTop: '1.5rem', border: '2px dashed var(--primary)', borderRadius: '8px', padding: '1rem', background: 'rgba(108, 92, 231, 0.05)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.05rem', marginBottom: formData.is_promotional ? '1rem' : '0' }}>
                  <input type="checkbox" checked={formData.is_promotional || false} onChange={e => setFormData({...formData, is_promotional: e.target.checked})} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
                  Por em Promoção (Destaque na Loja)
                </label>
                
                {formData.is_promotional && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label style={{ color: 'var(--text-main)' }}>Valor Promocional à Vista (R$)</label>
                        <input type="text" required value={maskCurrency(formData.promo_price_cash || 0)} onChange={e => handlePromoPriceChange('cash', e.target.value)} style={{ borderColor: 'var(--primary)' }} />
                      </div>
                      {formData.credit_type !== 'interest' && (
                        <div className="form-group">
                          <label style={{ color: 'var(--text-main)' }}>Valor Promocional a Prazo (R$)</label>
                          <input type="text" required value={maskCurrency(formData.promo_price_credit || 0)} onChange={e => handlePromoPriceChange('credit', e.target.value)} style={{ borderColor: 'var(--primary)' }} />
                        </div>
                      )}
                    </div>
                    <div className="form-row" style={{ marginTop: '1rem' }}>
                      <div className="form-group">
                        <label style={{ color: 'var(--text-main)' }}>Data de Início</label>
                        <input type="date" required value={formData.promo_start_date ? new Date(formData.promo_start_date).toISOString().split('T')[0] : ''} onChange={e => setFormData({...formData, promo_start_date: e.target.value ? new Date(e.target.value).toISOString() : ''})} style={{ borderColor: 'var(--primary)' }} />
                      </div>
                      <div className="form-group">
                        <label style={{ color: 'var(--text-main)' }}>Data Final</label>
                        <input type="date" required value={formData.promo_end_date ? new Date(formData.promo_end_date).toISOString().split('T')[0] : ''} onChange={e => setFormData({...formData, promo_end_date: e.target.value ? new Date(e.target.value).toISOString() : ''})} style={{ borderColor: 'var(--primary)' }} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          <div className="form-group" style={{marginTop: '1rem'}}>
            <label style={{marginBottom: '0.8rem'}}>Opções de Crediário (Fiado/Prazo)</label>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                <input type="checkbox" checked={formData.allow_credit !== false} onChange={(e) => setFormData({...formData, allow_credit: e.target.checked})} />
                Permitir Venda a Prazo para este item
              </label>
            </div>
            {formData.allow_credit !== false && (
              <>
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Modelo de Crediário:</p>
                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                      <input type="radio" name="credit_type" value="fixed" checked={formData.credit_type !== 'interest'} onChange={() => setFormData({...formData, credit_type: 'fixed'})} />
                      Preço a Prazo (Fixo)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                      <input type="radio" name="credit_type" value="interest" checked={formData.credit_type === 'interest'} onChange={() => setFormData({...formData, credit_type: 'interest'})} />
                      Com Juros ao Mês
                    </label>
                  </div>
                  
                  {formData.credit_type !== 'interest' && modalType === 'product' && (
                    <div className="form-row" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="form-group">
                        <label>Margem a Prazo (%)</label>
                        <input type="text" value={maskCurrency(formData.margin_credit || 0)} onChange={e => handleMarginChange('credit', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Preço Fiado / Prazo (R$)</label>
                        <input type="text" required value={maskCurrency(formData.price_credit || 0)} onChange={e => handlePriceChange('credit', e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
                
                {formData.credit_type === 'interest' && (
                  <div style={{ marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(239, 68, 68, 0.05)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Taxa de Juros ao Mês:</span>
                    <input type="number" min="0" step="0.01" value={formData.credit_interest_rate || 0} onChange={e => setFormData({...formData, credit_interest_rate: Number(e.target.value)})} style={{ width: '80px', padding: '0.5rem' }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>%</span>
                  </div>
                )}

                <div style={{ marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Dividir em até:</span>
                  <input type="number" min="1" max="24" value={formData.max_installments || 1} onChange={e => setFormData({...formData, max_installments: Number(e.target.value)})} style={{ width: '80px', padding: '0.5rem' }} />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>vezes (parcelas)</span>
                </div>
                
                <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    <input type="checkbox" checked={formData.punctuality_discount_active === true} onChange={(e) => setFormData({...formData, punctuality_discount_active: e.target.checked})} />
                    Aplicar Desconto de Pontualidade
                  </label>
                  {formData.punctuality_discount_active && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Desconto (%):</span>
                          <input type="number" min="0" max="100" step="0.01" value={formData.punctuality_discount_percent || 0} onChange={e => {
                            const percent = Number(e.target.value);
                            const basePrice = formData.price_credit || 0;
                            const value = basePrice > 0 ? (percent / 100) * basePrice : 0;
                            setFormData({...formData, punctuality_discount_percent: percent, punctuality_discount_value: value});
                          }} style={{ width: '80px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-lighter)', color: 'var(--text-main)' }} />
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>%</span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Desconto Fixo (R$):</span>
                          <input type="text" value={maskCurrency(formData.punctuality_discount_value || 0)} onChange={e => {
                            const value = parseCurrency(e.target.value);
                            const basePrice = formData.price_credit || 0;
                            const percent = basePrice > 0 ? (value / basePrice) * 100 : 0;
                            setFormData({...formData, punctuality_discount_value: value, punctuality_discount_percent: Number(percent.toFixed(2))});
                          }} style={{ width: '100px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-lighter)', color: 'var(--text-main)' }} />
                        </div>
                      </div>
                    )}
                  </div>
                
                {settingsData?.loyalty_active && (
                  <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      <input type="checkbox" checked={formData.loyalty_discount_active === true} onChange={(e) => setFormData({...formData, loyalty_discount_active: e.target.checked})} />
                      Aplicar Desconto de Cliente Fiel
                    </label>
                    {formData.loyalty_discount_active && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Desconto (%):</span>
                          <input type="number" min="0" max="100" step="0.01" value={formData.loyalty_discount_percent || 0} onChange={e => {
                            const percent = Number(e.target.value);
                            const basePrice = formData.price_credit || 0;
                            const value = basePrice > 0 ? (percent / 100) * basePrice : 0;
                            setFormData({...formData, loyalty_discount_percent: percent, loyalty_discount_value: value});
                          }} style={{ width: '80px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-lighter)', color: 'var(--text-main)' }} />
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>%</span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Desconto Fixo (R$):</span>
                          <input type="text" value={maskCurrency(formData.loyalty_discount_value || 0)} onChange={e => {
                            const value = parseCurrency(e.target.value);
                            const basePrice = formData.price_credit || 0;
                            const percent = basePrice > 0 ? (value / basePrice) * 100 : 0;
                            setFormData({...formData, loyalty_discount_value: value, loyalty_discount_percent: Number(percent.toFixed(2))});
                          }} style={{ width: '100px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-lighter)', color: 'var(--text-main)' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="form-group" style={{marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem'}}>
            <label style={{marginBottom: '0.8rem'}}>Status do Produto</label>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                <input type="radio" name="product_status" checked={formData.is_active === true} onChange={() => setFormData({...formData, is_active: true})} />
                Ativo
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                <input type="radio" name="product_status" checked={formData.is_active === false} onChange={() => setFormData({...formData, is_active: false})} />
                Inativo
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Gerenciar Categorias">
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, margin: 0 }}>
              <label style={{ marginBottom: '0.5rem', display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Nova Categoria</label>
              <input 
                type="text" 
                placeholder="Ex: Eletrônicos, Roupas..." 
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ height: '42px', padding: '0 1.5rem' }}>
              Adicionar
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
          {categories.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>Nenhuma categoria cadastrada.</p>
          ) : (
            categories.map(cat => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {editingCategoryId === cat.id ? (
                  <div style={{ display: 'flex', gap: '0.5rem', flex: 1, marginRight: '1rem' }}>
                    <input 
                      type="text" 
                      value={editingCategoryName}
                      onChange={e => setEditingCategoryName(e.target.value)}
                      style={{ flex: 1, padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--text-main)' }}
                      autoFocus
                    />
                    <button type="button" onClick={() => handleEditCategory(cat.id)} className="btn-primary" style={{ padding: '0 0.8rem' }}>Salvar</button>
                    <button type="button" onClick={() => { setEditingCategoryId(null); setEditingCategoryName(''); }} className="btn-secondary" style={{ padding: '0 0.8rem' }}>Cancelar</button>
                  </div>
                ) : (
                  <>
                    <span>{cat.name}</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className="btn-icon" onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }}>
                        <Edit size={16} />
                      </button>
                      <button type="button" className="btn-icon danger" onClick={() => setCategoryToDelete(cat.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal isOpen={deleteConfirmId !== null} onClose={cancelDelete} title="Confirmar Exclusão">
        <p>Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.</p>
        <div style={{display: 'flex', gap: '1rem', marginTop: '2rem'}}>
          <button className="btn-secondary" style={{flex: 1}} onClick={cancelDelete}>Cancelar</button>
          <button className="btn-primary" style={{flex: 1, background: 'var(--danger)'}} onClick={confirmDelete}>Excluir</button>
        </div>
      </Modal>

      <Modal isOpen={categoryToDelete !== null} onClose={() => setCategoryToDelete(null)} title="Excluir Categoria">
        <p>Tem certeza que deseja excluir esta categoria? Os produtos vinculados a ela ficarão sem categoria.</p>
        <div style={{display: 'flex', gap: '1rem', marginTop: '2rem'}}>
          <button className="btn-secondary" style={{flex: 1}} onClick={() => setCategoryToDelete(null)}>Cancelar</button>
          <button className="btn-primary" style={{flex: 1, background: 'var(--danger)'}} onClick={() => {
            if (categoryToDelete !== null) {
              handleDeleteCategory(categoryToDelete);
              setCategoryToDelete(null);
            }
          }}>Excluir</button>
        </div>
      </Modal>
    </div>
  );
}
