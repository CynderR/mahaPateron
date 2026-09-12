import React, { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { isIOSDevice } from '../utils/streamLoader';
import {
  getStoredToken,
  getStoredTokenSync,
  persistToken,
  clearStoredToken
} from '../native/tokenStorage';
import { isNativeApp } from '../native/platform';
import { isNetworkError, isUnauthorized } from '../native/network';
import { cacheNativeUser, clearCachedNativeUser, loadCachedNativeUser } from '../native/sessionCache';
import { hydrateCoverCache } from '../native/coverCache';
import { loadOfflineIndex } from '../native/offlineStorage';

export interface User {
  id: number;
  username: string;
  email: string;
  is_free: boolean;
  is_admin: boolean;
  payment_category?: 'full' | 'free' | 'paying_subscriber' | 'non_card';
  is_paying?: boolean | number;
  access_type?: 'rss' | 'streaming' | 'both';
  download_access?: boolean | number;
  app_access?: boolean | number;
  offline_use?: string | null;
  episodes_to_keep?: number | null;
  app_last_authenticated_at?: string | null;
  subscription_price?: number | null;
  rss_token?: string;
  stripe_customer_id?: string;
  stripe_sub_id?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  /** Re-fetch /profile so is_paying / payment_category stay in sync after billing. */
  refreshUser: () => Promise<User | null>;
  loading: boolean;
  isAdmin: boolean;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  verificationCode: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configure axios defaults
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['Cache-Control'] = 'no-cache';
axios.defaults.headers.common['Pragma'] = 'no-cache';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    const sync = getStoredTokenSync();
    if (sync) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${sync}`;
    }
    return sync;
  });
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.is_admin || false;

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use((config) => {
      const storedToken = getStoredTokenSync();
      if (storedToken) {
        config.headers.Authorization = `Bearer ${storedToken}`;
      }
      if (isIOSDevice() && (config.method ?? 'get').toLowerCase() === 'get') {
        const params = { ...(config.params as Record<string, unknown> | undefined) };
        params._ = Date.now();
        config.params = params;
      }
      return config;
    });

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (isNativeApp()) {
        await Promise.all([loadOfflineIndex(), hydrateCoverCache()]);
      }
      try {
        const storedToken = await getStoredToken();
        if (cancelled) return;
        if (storedToken) {
          setToken(storedToken);
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          try {
            const response = await axios.get('/profile');
            if (!cancelled) setUser(response.data);
            await cacheNativeUser(response.data);
          } catch (error) {
            console.error('Failed to fetch user profile:', error);
            if (isUnauthorized(error)) {
              await clearStoredToken();
              await clearCachedNativeUser();
              if (!cancelled) {
                setToken(null);
                delete axios.defaults.headers.common['Authorization'];
              }
            } else {
              const cached = await loadCachedNativeUser();
              if (!cancelled && cached) {
                setUser(cached as User);
              } else if (!cancelled && !isNetworkError(error)) {
                await clearStoredToken();
                setToken(null);
                delete axios.defaults.headers.common['Authorization'];
              }
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const response = await axios.get<User>('/profile');
      setUser(response.data);
      await cacheNativeUser(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
      return null;
    }
  }, []);

  const login = async (email: string, password: string, rememberMe = true) => {
    try {
      const response = await axios.post('/login', { email, password, rememberMe });
      const { user: userData, token: userToken } = response.data;

      setUser(userData);
      setToken(userToken);
      await persistToken(userToken, rememberMe);
      await cacheNativeUser(userData);
      axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const response = await axios.post('/register', userData);
      const { user: newUser, token: userToken } = response.data;

      setUser(newUser);
      setToken(userToken);
      await persistToken(userToken, true);
      await cacheNativeUser(newUser);
      axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    void clearStoredToken();
    void clearCachedNativeUser();
    delete axios.defaults.headers.common['Authorization'];
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    refreshUser,
    loading,
    isAdmin
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
