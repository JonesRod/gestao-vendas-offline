import { useState, useEffect } from 'react';
import { ShoppingBag, Package, ShoppingCart } from 'lucide-react';
import { api } from '../services/api';
import type { Product } from '../db/db';
import './StoreHome.css';

export default function StoreHome() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
              <span className="price-label">À Vista / Pix</span>
              {oldPriceCash && <span className="old-price">R$ {oldPriceCash.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>}
              <span className="current-price text-success">
                R$ {priceCash.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </span>
            </div>
            
            {(product.allow_credit !== false) && (
              <div className="price-item">
                <span className="price-label">A Prazo</span>
                <span className="current-price text-warning">
                  R$ {priceCredit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>
            )}
          </div>
          
          <button className="add-to-cart-btn">
            <ShoppingCart size={18} />
            Adicionar
          </button>
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
    </div>
  );
}
