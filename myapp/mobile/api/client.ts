import { Platform } from "react-native";

// Default API base URL:
// - Prefer EXPO_PUBLIC_API_BASE_URL when provided (for physical devices / custom setup)
// - Otherwise:
//   - Android emulator: 10.0.2.2 (host machine localhost)
//   - iOS simulator / web: localhost
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Platform.OS === "android"
    ? "http://10.0.2.2:5007/api"
    : "http://localhost:5007/api");

console.log('[API Client] Base URL:', API_BASE_URL);

// Token getter function - will be set by AuthContext
let getAuthToken: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  getAuthToken = getter;
}

async function request<T>(path: string, init?: RequestInit, requireAuth = false): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  console.log('[API Client] Fetching:', url);
  
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> ?? {}),
    };

    // Add auth token if available and required
    if (requireAuth && getAuthToken) {
      const token = await getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      } else if (requireAuth) {
        throw new Error("Authentication required but no token available");
      }
    }

    const res = await fetch(url, {
      ...(init ?? {}),
      headers,
    });

    console.log('[API Client] Response status:', res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error('[API Client] Error response:', text);
      let parsed: { message?: string; callsDisabled?: boolean; [k: string]: unknown } = {};
      try {
        parsed = JSON.parse(text);
      } catch {}
      const err = new Error(parsed.message || `Request failed (${res.status})`) as Error & { status?: number; body?: unknown; callsDisabled?: boolean };
      (err as any).status = res.status;
      (err as any).body = parsed;
      (err as any).callsDisabled = parsed.callsDisabled;
      throw err;
    }

    const data = await res.json();
    console.log('[API Client] Data received:', JSON.stringify(data).slice(0, 200));
    return data as T;
  } catch (error) {
    console.error('[API Client] Fetch error:', error);
    throw error;
  }
}

// Public API methods (no auth required)
export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" }, false);
}

export function apiPost<T>(path: string, body?: any): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined
  }, false);
}

export function apiPut<T>(path: string, body?: any): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined
  }, false);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" }, false);
}

// Authenticated API methods (auth required)
export function apiGetAuth<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" }, true);
}

export function apiPostAuth<T>(path: string, body?: any): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined
  }, true);
}

export function apiPutAuth<T>(path: string, body?: any): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined
  }, true);
}

export function apiPatchAuth<T>(path: string, body?: any): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined
  }, true);
}

export function apiDeleteAuth<T>(path: string, body?: any): Promise<T> {
  return request<T>(path, {
    method: "DELETE",
    body: body != null ? JSON.stringify(body) : undefined,
  }, true);
}


