import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type CartItem = {
  productId: string;
  shopId: string;
  shopName: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  /** Call-invoice expiry (ISO string). Customer has 15 min to place order. */
  invoiceExpiresAt?: string;
};

type CartContextValue = {
  items: CartItem[];
  shopId: string | null; // Current shop in cart (only one shop at a time)
  shopName: string | null;
  totalItems: number;
  totalAmount: number;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  getItemQuantity: (productId: string) => number;
};

// -----------------------------------------------------------------------------
// Storage key
// -----------------------------------------------------------------------------

const CART_STORAGE_KEY = '@bazaario_cart';

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from storage on mount
  useEffect(() => {
    async function loadCart() {
      try {
        const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const loadedItems = parsed.items || [];
          
          // Validate product IDs (must be 24-character hex strings for MongoDB ObjectId)
          const validItems = loadedItems.filter((item: CartItem) => {
            const isValidId = item.productId && /^[a-fA-F0-9]{24}$/.test(item.productId);
            if (!isValidId) {
              console.warn('[Cart] Removing invalid product:', item.productId);
            }
            return isValidId;
          });
          
          setItems(validItems);
        }
      } catch (error) {
        console.error('[Cart] Failed to load cart:', error);
      } finally {
        setIsLoaded(true);
      }
    }
    loadCart();
  }, []);

  // Save cart to storage whenever it changes
  useEffect(() => {
    if (!isLoaded) return;
    
    async function saveCart() {
      try {
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items }));
      } catch (error) {
        console.error('[Cart] Failed to save cart:', error);
      }
    }
    saveCart();
  }, [items, isLoaded]);

  // Get current shop info
  const shopId = items.length > 0 ? items[0].shopId : null;
  const shopName = items.length > 0 ? items[0].shopName : null;

  // Calculate totals
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Add item to cart
  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    setItems(prev => {
      // If cart has items from a different shop, clear it first
      if (prev.length > 0 && prev[0].shopId !== item.shopId) {
        return [{ ...item, quantity }];
      }

      // Check if item already exists
      const existingIndex = prev.findIndex(i => i.productId === item.productId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }

      // Add new item
      return [...prev, { ...item, quantity }];
    });
  }, []);

  // Remove item from cart
  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(item => item.productId !== productId));
  }, []);

  // Update item quantity
  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }

    setItems(prev => 
      prev.map(item => 
        item.productId === productId 
          ? { ...item, quantity } 
          : item
      )
    );
  }, [removeItem]);

  // Clear entire cart
  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // Check if item is in cart
  const isInCart = useCallback((productId: string) => {
    return items.some(item => item.productId === productId);
  }, [items]);

  // Get item quantity
  const getItemQuantity = useCallback((productId: string) => {
    const item = items.find(i => i.productId === productId);
    return item?.quantity || 0;
  }, [items]);

  const value: CartContextValue = {
    items,
    shopId,
    shopName,
    totalItems,
    totalAmount,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    isInCart,
    getItemQuantity,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
