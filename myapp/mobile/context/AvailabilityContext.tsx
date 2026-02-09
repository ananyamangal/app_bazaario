import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiGetAuth, apiPostAuth, apiPutAuth } from '../api/client';
import { useAuth } from './AuthContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type AvailabilityStatus = 'none' | 'pending' | 'approved' | 'declined' | 'expired';

export type AvailabilityRequest = {
  _id: string;
  customerId: string;
  sellerId: string;
  shopId: any;
  productId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  status: AvailabilityStatus;
  customerMessage?: string;
  sellerResponse?: string;
  respondedAt?: string;
  expiresAt: string;
  createdAt: string;
};

type ProductAvailability = {
  canAddToCart: boolean;
  status: AvailabilityStatus;
  request?: AvailabilityRequest;
  message?: string;
};

type AvailabilityContextValue = {
  // Check if product can be added to cart
  checkProductAvailability: (productId: string) => Promise<ProductAvailability>;
  // Request availability check from seller
  requestAvailability: (productId: string, quantity?: number, message?: string) => Promise<AvailabilityRequest | null>;
  // Get customer's requests
  getMyRequests: (status?: string) => Promise<AvailabilityRequest[]>;
  // For sellers: get pending requests
  getSellerRequests: (status?: string) => Promise<{ requests: AvailabilityRequest[]; pendingCount: number }>;
  // For sellers: respond to request
  respondToRequest: (requestId: string, approved: boolean, response?: string) => Promise<boolean>;
  // Cache of product availability
  availabilityCache: { [productId: string]: ProductAvailability };
  // Clear cache for a product
  clearCache: (productId?: string) => void;
  // Pending count for sellers
  pendingCount: number;
  // Refresh pending count
  refreshPendingCount: () => Promise<void>;
};

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const AvailabilityContext = createContext<AvailabilityContextValue | null>(null);

export function useAvailability() {
  const ctx = useContext(AvailabilityContext);
  if (!ctx) throw new Error('useAvailability must be used within AvailabilityProvider');
  return ctx;
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function AvailabilityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [availabilityCache, setAvailabilityCache] = useState<{ [productId: string]: ProductAvailability }>({});
  const [pendingCount, setPendingCount] = useState(0);

  // Check product availability
  const checkProductAvailability = useCallback(async (productId: string): Promise<ProductAvailability> => {
    try {
      const response = await apiGetAuth<ProductAvailability>(`/availability-requests/check/${productId}`);
      
      // Update cache
      setAvailabilityCache(prev => ({
        ...prev,
        [productId]: response,
      }));
      
      return response;
    } catch (error) {
      console.error('[Availability] Check failed:', error);
      return { canAddToCart: false, status: 'none', message: 'Failed to check availability' };
    }
  }, []);

  // Request availability
  const requestAvailability = useCallback(async (
    productId: string,
    quantity: number = 1,
    message?: string
  ): Promise<AvailabilityRequest | null> => {
    try {
      const response = await apiPostAuth<{ request: AvailabilityRequest }>('/availability-requests', {
        productId,
        quantity,
        message,
      });
      
      // Update cache
      setAvailabilityCache(prev => ({
        ...prev,
        [productId]: {
          canAddToCart: false,
          status: 'pending',
          request: response.request,
          message: 'Waiting for seller response',
        },
      }));
      
      return response.request;
    } catch (error: any) {
      console.error('[Availability] Request failed:', error);
      
      // If already has pending request, return it
      if (error.message?.includes('pending request')) {
        const cached = availabilityCache[productId];
        if (cached?.request) return cached.request;
      }
      
      return null;
    }
  }, [availabilityCache]);

  // Get customer's requests
  const getMyRequests = useCallback(async (status?: string): Promise<AvailabilityRequest[]> => {
    try {
      const url = status ? `/availability-requests/my?status=${status}` : '/availability-requests/my';
      const response = await apiGetAuth<{ requests: AvailabilityRequest[] }>(url);
      return response.requests;
    } catch (error) {
      console.error('[Availability] Get my requests failed:', error);
      return [];
    }
  }, []);

  // Get seller's requests
  const getSellerRequests = useCallback(async (status: string = 'pending'): Promise<{ requests: AvailabilityRequest[]; pendingCount: number }> => {
    try {
      const response = await apiGetAuth<{ requests: AvailabilityRequest[]; pendingCount: number }>(
        `/availability-requests/seller?status=${status}`
      );
      setPendingCount(response.pendingCount);
      return response;
    } catch (error) {
      console.error('[Availability] Get seller requests failed:', error);
      return { requests: [], pendingCount: 0 };
    }
  }, []);

  // Respond to request (seller)
  const respondToRequest = useCallback(async (
    requestId: string,
    approved: boolean,
    response?: string
  ): Promise<boolean> => {
    try {
      await apiPutAuth(`/availability-requests/${requestId}/respond`, {
        approved,
        response,
      });
      
      // Refresh pending count
      const result = await getSellerRequests('pending');
      setPendingCount(result.pendingCount);
      
      return true;
    } catch (error) {
      console.error('[Availability] Respond failed:', error);
      return false;
    }
  }, [getSellerRequests]);

  // Clear cache
  const clearCache = useCallback((productId?: string) => {
    if (productId) {
      setAvailabilityCache(prev => {
        const newCache = { ...prev };
        delete newCache[productId];
        return newCache;
      });
    } else {
      setAvailabilityCache({});
    }
  }, []);

  // Refresh pending count
  const refreshPendingCount = useCallback(async () => {
    if (user?.role === 'seller') {
      const result = await getSellerRequests('pending');
      setPendingCount(result.pendingCount);
    }
  }, [user?.role, getSellerRequests]);

  // Refresh pending count on mount for sellers
  useEffect(() => {
    if (user?.role === 'seller') {
      refreshPendingCount();
    }
  }, [user?.role, refreshPendingCount]);

  const value: AvailabilityContextValue = {
    checkProductAvailability,
    requestAvailability,
    getMyRequests,
    getSellerRequests,
    respondToRequest,
    availabilityCache,
    clearCache,
    pendingCount,
    refreshPendingCount,
  };

  return (
    <AvailabilityContext.Provider value={value}>
      {children}
    </AvailabilityContext.Provider>
  );
}
