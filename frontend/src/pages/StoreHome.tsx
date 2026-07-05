import { useState, useEffect } from 'react';
import { ShoppingBag, Package, ShoppingCart, Info, X } from 'lucide-react';
import { api } from '../services/api';
import type { Product } from '../db/db';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import './StoreHome.css';

export default function StoreHome() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Considera que tem crediário ativo se o limite for maior que zero e não estiver bloqueado
  const hasActiveCredit = user && user.credit_limit > 0 && !user.is_blocked;

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data } = await api.get('/products');
        setProducts(data);
      } catch (error) {
        console.error("Erro ao buscar produtos da loja", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const promoProducts = products.filter(p => p.is_promotional && p.is_active !== false);
  const otherProducts = products.filter(p => !p.is_promotional && p.is_active !== false);

  const renderProductCard = (product: Product, isPromo: boolean) => {
    const mainImage = product.images && product.images.length > 0 ? product.images[0] : null;
    const priceCash = isPromo && product.promo_price_cash ? product.promo_price_cash : product.price_cash;
    const priceCredit = isPromo && product.promo_price_credit ? product.promo_price_credit : product.price_credit;
    const oldPriceCash = isPromo && product.promo_price_cash ? product.price_cash : null;

    return (
      <div key={product.id} className="store-product-card glass-panel">
        <div className="store-product-img-container">
          {mainImage ? (
            <img src={mainImage} alt={product.name} className="store-product-img" />
          ) : (
            <div className="store-product-no-img">
              <Package size={40} className="text-muted" />
            </div>
          )}
          {isPromo && <div className="promo-badge">PROMOÇÃO</div>}
        </div>
        
        <div className="store-product-info">
          <h3 className="store-product-title">{product.name}</h3>
          
          <div className="store-product-prices">
            <div className="price-item">
              <span className="price-label">À Vista</span>
              {oldPriceCash && <span className="old-price">R$ {oldPriceCash.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>}
              <span className="current-price text-success">
                R$ {priceCash.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </span>
            </div>
            
            {(product.allow_credit !== false && hasActiveCredit) && (
              <div className="price-item">
                <span className="price-label">A Prazo</span>
                <span className="current-price text-warning">
                  R$ {priceCredit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button className="add-to-cart-btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }} onClick={() => setSelectedProduct(product)}>
              <Info size={18} />
              Detalhes
            </button>
            <button className="add-to-cart-btn" style={{ flex: 1 }} onClick={() => {
              addToCart(product);
              showToast('Produto adicionado ao carrinho!');
            }}>
              <ShoppingCart size={18} />
              Adicionar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="store-container store-home">
      <div className="hero-section glass-panel">
        <div className="hero-content">
          <h1>Bem-vindo à nossa Loja!</h1>
          <p>Faça seus pedidos de forma rápida e prática diretamente pelo nosso portal online.</p>
        </div>
        <div className="hero-icon">
          <ShoppingBag size={120} style={{ opacity: 0.2 }} />
        </div>
      </div>
      
      {loading ? (
        <div className="products-preview">
          <h2>Carregando produtos...</h2>
          <div className="products-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="product-card glass-panel placeholder">
                 <div className="placeholder-img"></div>
                 <div className="placeholder-text"></div>
                 <div className="placeholder-text short"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {promoProducts.length > 0 && (
            <div className="products-preview" style={{ marginBottom: '4rem' }}>
              <h2>Produtos em Destaque</h2>
              <div className="products-grid">
                {promoProducts.map(p => renderProductCard(p, true))}
              </div>
            </div>
          )}
          
          {otherProducts.length > 0 && (
            <div className="products-preview">
              <h2>Nossos Produtos</h2>
              <div className="products-grid">
                {otherProducts.map(p => renderProductCard(p, false))}
              </div>
            </div>
          )}
        </>
      )}

      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--text-main)', margin: 0 }}>{selectedProduct.name}</h2>
              <button className="btn-icon" onClick={() => setSelectedProduct(null)}>
                <X size={24} />
              </button>
            </div>
            
            {selectedProduct.images && selectedProduct.images.length > 0 ? (
              <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', marginBottom: '1.5rem' }}>
                {selectedProduct.images.map((img, i) => (
                  <img key={i} src={img} alt={`Imagem ${i+1}`} style={{ height: '200px', borderRadius: '8px', objectFit: 'cover' }} />
                ))}
              </div>
            ) : (
              <div style={{ width: '100%', height: '200px', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <Package size={60} className="text-muted" />
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Descrição</h3>
              <p style={{ color: 'var(--text-main)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{selectedProduct.description || 'Nenhuma descrição disponível para este produto.'}</p>
            </div>
            
            <button className="btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} onClick={() => {
              if (selectedProduct) {
                addToCart(selectedProduct);
                showToast('Produto adicionado ao carrinho!');
              }
              setSelectedProduct(null);
            }}>
              <ShoppingCart size={20} />
              Adicionar ao Carrinho
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--success)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <ShoppingCart size={20} />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
