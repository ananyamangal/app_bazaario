import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WISHLIST_STORAGE_KEY = '@bazaario_wishlist';

export type WishlistItem = {
  id: string;
  type: 'shop' | 'product';
  name: string;
  image?: string;
  price?: number;
  shopId?: string;
  shopName?: string;
  rating?: number;
};

type WishlistContextValue = {
  items: WishlistItem[];
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (id: string) => void;
  isInWishlist: (id: string) => boolean;
  clearWishlist: () => void;
  totalItems: number;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load wishlist from storage
  useEffect(() => {
    async function loadWishlist() {
      try {
        const stored = await AsyncStorage.getItem(WISHLIST_STORAGE_KEY);
        if (stored) {
          setItems(JSON.parse(stored));
        }
      } catch (error) {
        console.warn('[Wishlist] Failed to load:', error);
      } finally {
        setLoaded(true);
      }
    }
    loadWishlist();
  }, []);

  // Save wishlist to storage
  useEffect(() => {
    if (!loaded) return;
    async function saveWishlist() {
      try {
        await AsyncStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
      } catch (error) {
        console.warn('[Wishlist] Failed to save:', error);
      }
    }
    saveWishlist();
  }, [items, loaded]);

  function addToWishlist(item: WishlistItem) {
    setItems(prev => {
      if (prev.some(i => i.id === item.id)) return prev;
      return [...prev, item];
    });
  }

  function removeFromWishlist(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function isInWishlist(id: string) {
    return items.some(i => i.id === id);
  }

  function clearWishlist() {
    setItems([]);
  }

  const value: WishlistContextValue = {
    items,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    clearWishlist,
    totalItems: items.length,
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
