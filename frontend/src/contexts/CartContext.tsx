import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product } from '../db/db';

export interface CartItem {
  product: Product;
  quantity: number;
  installments: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  updateInstallments: (productId: number, installments: number) => void;
  clearCart: () => void;
  cartTotalCash: number;
  cartTotalCredit: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('@GestaoOffline:cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('@GestaoOffline:cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity, installments: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.product.id === productId ? { ...item, quantity } : item
    ));
  };

  const updateInstallments = (productId: number, installments: number) => {
    setCart(prev => prev.map(item => 
      item.product.id === productId ? { ...item, installments } : item
    ));
  };

  const clearCart = () => setCart([]);

  const cartTotalCash = cart.reduce((total, item) => {
    const price = item.product.is_promotional && item.product.promo_price_cash 
      ? item.product.promo_price_cash 
      : item.product.price_cash;
    return total + (price * item.quantity);
  }, 0);

  const cartTotalCredit = cart.reduce((total, item) => {
    const isPromo = item.product.is_promotional;
    const baseCreditPrice = isPromo && item.product.promo_price_credit ? item.product.promo_price_credit : item.product.price_credit;
    const baseCashPrice = isPromo && item.product.promo_price_cash ? item.product.promo_price_cash : item.product.price_cash;
    
    const price = item.product.credit_type === 'interest' ? baseCashPrice : baseCreditPrice;
    
    const itemBaseTotal = price * item.quantity;
    let interest = 0;
    if (item.product.credit_type === 'interest') {
      const rate = (item.product.credit_interest_rate || 0) / 100;
      interest = itemBaseTotal * rate * (item.installments || 1);
    }

    return total + itemBaseTotal + interest;
  }, 0);

  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, updateInstallments, clearCart, cartTotalCash, cartTotalCredit, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
