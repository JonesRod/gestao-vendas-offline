import React from 'react';
import { ShoppingBag } from 'lucide-react';
import './StoreHome.css';

export default function StoreHome() {
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
      
      <div className="products-preview">
        <h2>Produtos em Destaque</h2>
        <p style={{ color: 'var(--text-muted)' }}>Os produtos serão carregados aqui em breve...</p>
        
        {/* Futura listagem de produtos com botão "Adicionar ao Carrinho" */}
        <div className="products-grid">
          <div className="product-card glass-panel placeholder">
             <div className="placeholder-img"></div>
             <div className="placeholder-text"></div>
             <div className="placeholder-text short"></div>
          </div>
          <div className="product-card glass-panel placeholder">
             <div className="placeholder-img"></div>
             <div className="placeholder-text"></div>
             <div className="placeholder-text short"></div>
          </div>
          <div className="product-card glass-panel placeholder">
             <div className="placeholder-img"></div>
             <div className="placeholder-text"></div>
             <div className="placeholder-text short"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
