import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Payload sent from backend when seller approves availability (so we can add to cart).
 * All values are strings from push notification data.
 */
export type PendingAvailabilityCartPayload = {
  productId: string;
  shopId: string;
  shopName: string;
  productName: string;
  productImage?: string;
  quantity: string;
  price: string;
};

type ContextValue = {
  pending: PendingAvailabilityCartPayload | null;
  setPending: (payload: PendingAvailabilityCartPayload | null) => void;
};

const AvailabilityCartContext = createContext<ContextValue | null>(null);

export function useAvailabilityCart() {
  const ctx = useContext(AvailabilityCartContext);
  if (!ctx) throw new Error('useAvailabilityCart must be used within AvailabilityCartProvider');
  return ctx;
}

export function AvailabilityCartProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingAvailabilityCartPayload | null>(null);
  return (
    <AvailabilityCartContext.Provider value={{ pending, setPending }}>
      {children}
    </AvailabilityCartContext.Provider>
  );
}
