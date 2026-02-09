import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useCart, CartItem as RealCartItem } from './CartContext';
import { useAuth } from './AuthContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type CartItem = {
  id: string;
  shopId: string;
  shopName: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
};

export type SavedAddress = {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
};

export type CheckoutContact = { name: string; phone: string; notes: string };

export type CheckoutSchedule = { type: 'instant' | 'scheduled'; date?: string; time?: string };

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet' | 'cod';

type CheckoutContextValue = {
  // Cart (synced from CartContext)
  items: CartItem[];
  updateQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  shopId: string | null;
  // Address & contact
  address: SavedAddress | null;
  setAddress: (a: SavedAddress | null) => void;
  savedAddresses: SavedAddress[];
  contact: CheckoutContact;
  setContact: (c: Partial<CheckoutContact>) => void;
  // Schedule
  schedule: CheckoutSchedule;
  setSchedule: (s: CheckoutSchedule) => void;
  // Invoice
  promoCode: string;
  setPromoCode: (s: string) => void;
  promoDiscount: number;
  setPromoDiscount: (n: number) => void;
  walletApplied: number;
  setWalletApplied: (n: number) => void;
  walletBalance: number;
  // Payment
  paymentMethod: PaymentMethod | null;
  setPaymentMethod: (p: PaymentMethod | null) => void;
  // Computed
  subtotal: number;
  platformFee: number;
  discount: number;
  tax: number;
  total: number;
  // Checkout reset
  resetCheckout: () => void;
};

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const PLATFORM_FEE_RATE = 0.02;
const TAX_RATE = 0.05;
const WALLET_BALANCE = 200;

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export function useCheckout() {
  const v = useContext(CheckoutContext);
  if (!v) throw new Error('useCheckout must be used within CheckoutProvider');
  return v;
}

export function CheckoutProvider({ children }: { children: React.ReactNode }) {
  // Get cart data from CartContext
  const cart = useCart();
  const { user, profile } = useAuth();
  
  // Convert CartContext items to CheckoutContext format
  const items: CartItem[] = useMemo(() => 
    cart.items.map(item => ({
      id: item.productId,
      shopId: item.shopId,
      shopName: item.shopName,
      name: item.name,
      price: item.price,
      qty: item.quantity,
      image: item.image,
    })),
    [cart.items]
  );

  // Get saved addresses from user profile
  const savedAddresses: SavedAddress[] = useMemo(() => {
    if (profile && 'savedAddresses' in profile) {
      return (profile.savedAddresses || []).map((addr: any, idx: number) => {
        // Support both legacy AddressSchema shape and new mobile-friendly shape
        const label = addr.label || addr.name || 'Address';
        const line1 = addr.line1 || addr.street || '';
        const line2 = addr.line2 || '';
        return {
          id: addr._id || `addr-${idx}`,
          label,
          line1,
          line2,
          city: addr.city || '',
          state: addr.state || '',
          pincode: addr.pincode || '',
          phone: addr.phone || '',
        };
      });
    }
    return [];
  }, [profile]);

  const [address, setAddress] = useState<SavedAddress | null>(null);
  const [contact, setContactState] = useState<CheckoutContact>({ 
    name: user?.name || '', 
    phone: user?.phone || '', 
    notes: '' 
  });
  const [schedule, setSchedule] = useState<CheckoutSchedule>({ type: 'instant' });
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscountState] = useState(0);
  const [walletApplied, setWalletApplied] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  // Update contact when user changes
  useEffect(() => {
    if (user) {
      setContactState(prev => ({
        ...prev,
        name: user.name || prev.name,
        phone: user.phone || prev.phone,
      }));
    }
  }, [user]);

  // Set default address when addresses load
  useEffect(() => {
    if (savedAddresses.length > 0 && !address) {
      setAddress(savedAddresses[0]);
    }
  }, [savedAddresses, address]);

  const setContact = (c: Partial<CheckoutContact>) => setContactState((p) => ({ ...p, ...c }));

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);
  const platformFee = Math.round(subtotal * PLATFORM_FEE_RATE);
  const discount = promoDiscount;
  const tax = Math.round((subtotal - discount + platformFee) * TAX_RATE);
  const total = Math.max(0, subtotal + platformFee - discount + tax - walletApplied);

  const updateQty = (id: string, qty: number) => {
    if (qty < 1) {
      cart.removeItem(id);
    } else {
      cart.updateQuantity(id, qty);
    }
  };

  const removeItem = (id: string) => cart.removeItem(id);

  const clearCart = () => cart.clearCart();

  const setPromoDiscount = (n: number) => setPromoDiscountState(Math.max(0, n));

  const resetCheckout = () => {
    cart.clearCart();
    setAddress(savedAddresses[0] || null);
    setContactState({ name: user?.name || '', phone: user?.phone || '', notes: '' });
    setSchedule({ type: 'instant' });
    setPromoCode('');
    setPromoDiscountState(0);
    setWalletApplied(0);
    setPaymentMethod(null);
  };

  const value: CheckoutContextValue = {
    items,
    updateQty,
    removeItem,
    clearCart,
    shopId: cart.shopId,
    address,
    setAddress,
    savedAddresses,
    contact,
    setContact,
    schedule,
    setSchedule,
    promoCode,
    setPromoCode,
    promoDiscount,
    setPromoDiscount,
    walletApplied,
    setWalletApplied,
    walletBalance: WALLET_BALANCE,
    paymentMethod,
    setPaymentMethod,
    subtotal,
    platformFee,
    discount,
    tax,
    total,
    resetCheckout,
  };

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}
