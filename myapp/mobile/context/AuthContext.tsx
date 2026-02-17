import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithCredential,
  PhoneAuthProvider,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signOut as firebaseSignOut,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { auth } from "../config/firebase";
import { apiGet, apiPost, apiPut, API_BASE_URL } from "../api/client";

WebBrowser.maybeCompleteAuthSession();

// Direct Firebase: Google Sign-In (native) – requires dev build (npx expo prebuild && npx expo run:android/ios)
const GOOGLE_SIGNIN_MODULE = "@react-native-google-signin/google-signin";
let GoogleSigninModule: any = null;
try {
  GoogleSigninModule = require(GOOGLE_SIGNIN_MODULE);
} catch {
  // Not available in Expo Go; use development build for Google sign-in
}

// Direct Firebase: Facebook SDK (native) – requires dev build
const FBSDK_MODULE = "react-native-fbsdk-next";
let FBSDK: any = null;
try {
  FBSDK = require(FBSDK_MODULE);
} catch {
  // Not available in Expo Go; use development build for Facebook sign-in
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type UserRole = "customer" | "seller";

export type AppUser = {
  _id: string;
  uid: string;
  role: UserRole;
  phone: string | null;
  email: string | null;
  name: string | null;
  photoURL: string | null;
};

export type CustomerProfile = {
  _id: string;
  userId: string;
  savedAddresses: SavedAddress[];
  preferredCategories: string[];
  totalOrders: number;
};

export type SellerProfile = {
  _id: string;
  userId: string;
  businessName: string;
  businessType: string;
  verificationStatus: "pending" | "verified" | "rejected";
  supportContact: string;
  totalShops: number;
  ratingAverage: number;
};

export type SavedAddress = {
  _id?: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
};

export type Shop = {
  _id: string;
  sellerId: string;
  name: string;
  description: string;
  categories: string[];
  images: string[];
  isActive: boolean;
  ratingAverage?: number;
  reviewCount?: number;
  chatEnabled?: boolean;
  videoEnabled?: boolean;
  instantCallsEnabled?: boolean;
  businessPhone?: string;
  businessEmail?: string;
  bankDetails?: {
    accountHolder?: string;
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
  };
  callTimings?: {
    start?: string;
    end?: string;
  };
};

type AuthContextValue = {
  // State
  firebaseUser: FirebaseUser | null;
  user: AppUser | null;
  profile: CustomerProfile | SellerProfile | null;
  shop: Shop | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Auth functions
  signInWithPhone: (
    verificationId: string,
    verificationCode: string
  ) => Promise<void>;
  signInWithGoogle: (role: UserRole) => Promise<{ needsProfile: boolean; role: UserRole } | void>;
  signInWithFacebook: (role: UserRole) => Promise<void>;
  registerCustomer: (data: {
    phone: string;
    name?: string;
    email?: string;
  }) => Promise<void>;
  registerSeller: (data: {
    phone: string;
    name?: string;
    email?: string;
    shopName: string;
    shopDescription?: string;
    market: string;
    city: string;
    shopAddress: string;
    categories: string[];
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signInWithSession: (data: {
    user: AppUser | null;
    profile: CustomerProfile | SellerProfile | null;
    shop: Shop | null;
    sessionToken: string;
  }) => Promise<void>;
  updateSessionUser: (data: {
    user: AppUser;
    profile: CustomerProfile | SellerProfile | null;
    shop: Shop | null;
  }) => void;

  // Profile functions
  updateProfile: (data: Partial<AppUser>) => Promise<void>;
  updateAddresses: (addresses: SavedAddress[]) => Promise<void>;

  // Token helper
  getIdToken: () => Promise<string | null>;
};

// -----------------------------------------------------------------------------
// Storage keys
// -----------------------------------------------------------------------------

const STORAGE_KEYS = {
  USER: "@bazaario_user",
  PROFILE: "@bazaario_profile",
  SHOP: "@bazaario_shop",
  SESSION_TOKEN: "@bazaario_session_token",
};

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | SellerProfile | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!firebaseUser || !!sessionToken;

  // Get ID token for API calls (Firebase ID token or backend session JWT)
  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (firebaseUser) {
      try {
        return await firebaseUser.getIdToken();
      } catch (error) {
        console.error("[Auth] Failed to get ID token:", error);
        return null;
      }
    }
    if (sessionToken) return sessionToken;
    return null;
  }, [firebaseUser, sessionToken]);

  // Load cached data from storage
  const loadCachedData = useCallback(async () => {
    try {
      const [userJson, profileJson, shopJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.SHOP),
      ]);

      if (userJson) setUser(JSON.parse(userJson));
      if (profileJson) setProfile(JSON.parse(profileJson));
      if (shopJson) setShop(JSON.parse(shopJson));
    } catch (error) {
      console.error("[Auth] Failed to load cached data:", error);
    }
  }, []);

  // Save data to storage
  const saveToStorage = useCallback(
    async (userData: AppUser | null, profileData: any, shopData: Shop | null) => {
      try {
        await Promise.all([
          userData
            ? AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData))
            : AsyncStorage.removeItem(STORAGE_KEYS.USER),
          profileData
            ? AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profileData))
            : AsyncStorage.removeItem(STORAGE_KEYS.PROFILE),
          shopData
            ? AsyncStorage.setItem(STORAGE_KEYS.SHOP, JSON.stringify(shopData))
            : AsyncStorage.removeItem(STORAGE_KEYS.SHOP),
        ]);
      } catch (error) {
        console.error("[Auth] Failed to save to storage:", error);
      }
    },
    []
  );

  // Fetch user data from backend
  const fetchUserData = useCallback(
    async (fbUser: FirebaseUser) => {
      try {
        const token = await fbUser.getIdToken();
        const response = await fetch(
          `${API_BASE_URL}/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.status === 404) {
          // User not registered in backend yet
          return { user: null, profile: null, shop: null };
        }

        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error("[Auth] Failed to fetch user data:", error);
        return { user: null, profile: null, shop: null };
      }
    },
    []
  );

  // Refresh user data from backend (Firebase or session token)
  const refreshUser = useCallback(async () => {
    if (firebaseUser) {
      try {
        const data = await fetchUserData(firebaseUser);
        if (data.user) {
          setUser(data.user);
          setProfile(data.profile);
          setShop(data.shop);
          await saveToStorage(data.user, data.profile, data.shop);
        }
      } catch (error) {
        console.error("[Auth] Failed to refresh user:", error);
      }
      return;
    }
    if (sessionToken) {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setProfile(data.profile);
          setShop(data.shop);
          await saveToStorage(data.user, data.profile, data.shop);
        }
      } catch (error) {
        console.error("[Auth] Failed to refresh user (session):", error);
      }
    }
  }, [firebaseUser, sessionToken, fetchUserData, saveToStorage]);

  // Restore backend session from storage (when Firebase network failed and we used sessionToken)
  const restoreSessionFromStorage = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      if (!stored) return;
      const [userJson, profileJson, shopJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.SHOP),
      ]);
      setSessionToken(stored);
      if (userJson) setUser(JSON.parse(userJson));
      if (profileJson) setProfile(JSON.parse(profileJson));
      if (shopJson) setShop(JSON.parse(shopJson));
    } catch (e) {
      console.error("[Auth] Restore session failed:", e);
    }
  }, []);

  // Don't block app forever if backend is slow (e.g. Render cold start)
  const AUTH_ME_TIMEOUT_MS = 12_000;

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log("[Auth] Auth state changed:", fbUser?.uid);
      setFirebaseUser(fbUser);

      if (fbUser) {
        setSessionToken(null);
        await AsyncStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
        // Try to load cached data first so UI can show quickly
        await loadCachedData();

        // Fetch fresh data from backend with timeout so we don't hang on slow/cold server
        try {
          const data = await Promise.race([
            fetchUserData(fbUser),
            new Promise<{ user: null; profile: null; shop: null }>((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), AUTH_ME_TIMEOUT_MS)
            ),
          ]);
          if (data.user) {
            setUser(data.user);
            setProfile(data.profile);
            setShop(data.shop);
            await saveToStorage(data.user, data.profile, data.shop);
          }
        } catch (e) {
          if ((e as Error)?.message === "timeout") {
            console.warn("[Auth] /auth/me timed out; using cached data if any");
          }
          // Keep state from loadCachedData so app is still usable
        }
      } else {
        // No Firebase user: restore backend session if we have a stored sessionToken
        await restoreSessionFromStorage();
        const hasSession = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
        if (!hasSession) {
          setUser(null);
          setProfile(null);
          setShop(null);
          await saveToStorage(null, null, null);
        }
      }

      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [loadCachedData, fetchUserData, saveToStorage, restoreSessionFromStorage]);

  // Sign in with phone (after OTP verification)
  const signInWithPhone = useCallback(
    async (verificationId: string, verificationCode: string) => {
      try {
        const credential = PhoneAuthProvider.credential(
          verificationId,
          verificationCode
        );
        await signInWithCredential(auth, credential);
        // Auth state listener will handle the rest
      } catch (error) {
        console.error("[Auth] Phone sign in failed:", error);
        throw error;
      }
    },
    []
  );

  // Register backend user after social sign-in (when GET /auth/me returns 404)
  const registerSocialUser = useCallback(
    async (fbUser: FirebaseUser, role: UserRole) => {
      const token = await fbUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: fbUser.uid,
          role,
          phone: null,
          email: fbUser.email || null,
          name: fbUser.displayName || null,
          photoURL: fbUser.photoURL || null,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Registration failed");
      }
      const data = await fetchUserData(fbUser);
      if (data.user) {
        setUser(data.user);
        setProfile(data.profile);
        setShop(data.shop);
        await saveToStorage(data.user, data.profile, data.shop);
      }
    },
    [fetchUserData, saveToStorage]
  );

  // Sign in with Google: native SDK in dev builds, OAuth code flow in Expo Go
  const signInWithGoogle = useCallback(
    async (role: UserRole) => {
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      if (!webClientId) {
        throw new Error("Google sign-in is not configured (EXPO_PUBLIC_GOOGLE_CLIENT_ID)");
      }

      let idToken: string | null = null;

      if (GoogleSigninModule) {
        // Native flow (development build)
        const { GoogleSignin } = GoogleSigninModule;
        GoogleSignin.configure({ webClientId });
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const result = await GoogleSignin.signIn();
        const user = (result as any)?.data?.user ?? (result as any)?.user;
        if (!user) throw new Error("Google sign-in was cancelled");
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken ?? null;
        if (!idToken) throw new Error("Could not get Google id token");
      } else {
        // Expo Go / web: OAuth code flow (opens browser, then exchange code for id_token via backend)
        // Your Expo SDK version does not expose AuthSession.startAsync, so we use WebBrowser directly.
        // Redirect URI MUST match the Web client redirect in Google Cloud:
        //   https://auth.expo.io/@hassan0101/myapp
        const redirectUri = "https://auth.expo.io/@hassan0101/myapp";
        const scope = "openid email profile";
        const authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(webClientId)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=code` +
          `&scope=${encodeURIComponent(scope)}` +
          "&access_type=offline&prompt=consent";

        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
        if (result.type !== "success" || !result.url) {
          throw new Error("Google sign-in was cancelled");
        }

        const match = result.url.match(/[?&]code=([^&]+)/);
        const code = match?.[1];
        if (!code) {
          const errMatch = result.url.match(/[?&]error=([^&]+)/);
          throw new Error(errMatch ? `Google sign-in failed: ${errMatch[1]}` : "Google sign-in failed");
        }

        console.log("[Google Auth] Exchanging code for token...", { code: code.substring(0, 20) + "...", redirectUri });
        const res = await fetch(`${API_BASE_URL}/auth/google-id-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        });
        if (!res.ok) {
          const errText = await res.text();
          let errMessage = "Failed to get Google token";
          try {
            const errJson = JSON.parse(errText);
            errMessage = errJson.message || errMessage;
          } catch {
            errMessage = errText || `Server error: ${res.status}`;
          }
          console.error("[Google Auth] Backend error:", res.status, errMessage);
          throw new Error(errMessage);
        }
        const data = (await res.json()) as { idToken?: string };
        idToken = data.idToken ?? null;
        if (!idToken) throw new Error("No id token from server");
      }

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);

      let needsProfile = false;
      const fbUser = auth.currentUser;
      if (fbUser) {
        const data = await fetchUserData(fbUser);
        if (!data.user) {
          await registerSocialUser(fbUser, role);
          // Newly created social user – require onboarding for sellers
          if (role === "seller") {
            needsProfile = true;
          }
        } else {
          // Existing user: if seller without shop/profile, also require onboarding
          if (role === "seller" && !data.shop) {
            needsProfile = true;
          }
        }
      }

      if (needsProfile) {
        return { needsProfile: true, role };
      }
    },
    [fetchUserData, registerSocialUser]
  );

  // Sign in with Facebook (direct Firebase via native SDK)
  const signInWithFacebook = useCallback(
    async (role: UserRole) => {
      const appId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
      if (!appId) {
        throw new Error("Facebook sign-in is not configured (EXPO_PUBLIC_FACEBOOK_APP_ID)");
      }
      if (!FBSDK) {
        throw new Error(
          "Facebook Sign-In requires a development build. Run: npx expo prebuild && npx expo run:android (or run:ios)"
        );
      }

      const { LoginManager, Settings } = FBSDK;
      Settings.setAppID(appId);
      Settings.initializeSDK();

      const result = await LoginManager.logInWithPermissions(["email", "public_profile"]);
      const cancelled = (result as any).isCancelled === true;
      const token = (result as any).token ?? (result as any).result?.token;
      const accessToken = token?.accessToken;
      if (cancelled || !accessToken) {
        throw new Error("Facebook sign-in was cancelled or failed");
      }
      const credential = FacebookAuthProvider.credential(accessToken);
      await signInWithCredential(auth, credential);

      const fbUser = auth.currentUser;
      if (fbUser) {
        const data = await fetchUserData(fbUser);
        if (!data.user) await registerSocialUser(fbUser, role);
      }
    },
    [fetchUserData, registerSocialUser]
  );

  // Register as customer
  const registerCustomer = useCallback(
    async (data: { phone: string; name?: string; email?: string }) => {
      if (!firebaseUser) {
        throw new Error("Not authenticated with Firebase");
      }

      try {
        const token = await firebaseUser.getIdToken();
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_BASE_URL}/auth/register`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              uid: firebaseUser.uid,
              role: "customer",
              phone: data.phone,
              name: data.name,
              email: data.email,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Registration failed");
        }

        // Refresh user data
        await refreshUser();
      } catch (error) {
        console.error("[Auth] Customer registration failed:", error);
        throw error;
      }
    },
    [firebaseUser, refreshUser]
  );

  // Register as seller
  const registerSeller = useCallback(
    async (data: {
      phone: string;
      name?: string;
      email?: string;
      shopName: string;
      shopDescription?: string;
      market: string;
      city: string;
      shopAddress: string;
      categories: string[];
    }) => {
      if (!firebaseUser) {
        throw new Error("Not authenticated with Firebase");
      }

      try {
        const token = await firebaseUser.getIdToken();
        const response = await fetch(
          `${API_BASE_URL}/auth/register-seller`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              uid: firebaseUser.uid,
              phone: data.phone,
              name: data.name,
              email: data.email,
              shopName: data.shopName,
              shopDescription: data.shopDescription,
              market: data.market,
              city: data.city,
              shopAddress: data.shopAddress,
              categories: data.categories,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Registration failed");
        }

        // Refresh user data
        await refreshUser();
      } catch (error) {
        console.error("[Auth] Seller registration failed:", error);
        throw error;
      }
    },
    [firebaseUser, refreshUser]
  );

  // Sign in with backend session (fallback when Firebase network fails)
  const signInWithSession = useCallback(
    async (data: {
      user: AppUser | null;
      profile: CustomerProfile | SellerProfile | null;
      shop: Shop | null;
      sessionToken: string;
    }) => {
      setSessionToken(data.sessionToken);
      setUser(data.user);
      setProfile(data.profile);
      setShop(data.shop);
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, data.sessionToken);
      await saveToStorage(data.user, data.profile, data.shop);
    },
    [saveToStorage]
  );

  // Update user/profile/shop after complete-registration (session mode)
  const updateSessionUser = useCallback(
    (data: {
      user: AppUser;
      profile: CustomerProfile | SellerProfile | null;
      shop: Shop | null;
    }) => {
      setUser(data.user);
      setProfile(data.profile);
      setShop(data.shop);
      saveToStorage(data.user, data.profile, data.shop);
    },
    [saveToStorage]
  );

  // Sign out
  const signOut = useCallback(async () => {
    setSessionToken(null);
    setUser(null);
    setProfile(null);
    setShop(null);
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEYS.USER),
        AsyncStorage.removeItem(STORAGE_KEYS.PROFILE),
        AsyncStorage.removeItem(STORAGE_KEYS.SHOP),
      ]);
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("[Auth] Sign out failed:", error);
      throw error;
    }
  }, []);

  // Update profile
  const updateProfile = useCallback(
    async (data: Partial<AppUser>) => {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/profile`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update profile");
        }

        const result = await response.json();
        setUser(result.user);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(result.user));
      } catch (error) {
        console.error("[Auth] Profile update failed:", error);
        throw error;
      }
    },
    [getIdToken]
  );

  // Update addresses
  const updateAddresses = useCallback(
    async (addresses: SavedAddress[]) => {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/addresses`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ addresses }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update addresses");
        }

        // Update local profile
        if (profile && "savedAddresses" in profile) {
          const updatedProfile = { ...profile, savedAddresses: addresses };
          setProfile(updatedProfile as CustomerProfile);
          await AsyncStorage.setItem(
            STORAGE_KEYS.PROFILE,
            JSON.stringify(updatedProfile)
          );
        }
      } catch (error) {
        console.error("[Auth] Addresses update failed:", error);
        throw error;
      }
    },
    [getIdToken, profile]
  );

  const value: AuthContextValue = {
    firebaseUser,
    user,
    profile,
    shop,
    isLoading,
    isAuthenticated,
    signInWithPhone,
    signInWithGoogle,
    signInWithFacebook,
    registerCustomer,
    registerSeller,
    signOut,
    refreshUser,
    signInWithSession,
    updateSessionUser,
    updateProfile,
    updateAddresses,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
