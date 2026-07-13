import React, { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { isIOSDevice } from '../utils/streamLoader';

interface User {
  id: number;
  username: string;
  email: string;
  is_free: boolean;
  is_admin: boolean;
  whatsapp_id?: string;
  signal_id?: string;
  payment_category?: 'full' | 'free' | 'paying_subscriber' | 'non_card';
  is_paying?: boolean | number;
  access_type?: 'rss' | 'streaming' | 'both';
  download_access?: boolean | number;
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

const TOKEN_KEY = 'token';
const REMEMBER_ME_KEY = 'rememberMe';

const getStoredToken = (): string | null =>
  localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

const persistToken = (token: string, rememberMe: boolean) => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (rememberMe) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_ME_KEY, 'true');
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_ME_KEY, 'false');
  }
};

const clearStoredToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};

// Configure axios defaults
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['Cache-Control'] = 'no-cache';
axios.defaults.headers.common['Pragma'] = 'no-cache';

const bootstrapAuthToken = (): string | null => {
  const storedToken = getStoredToken();
  if (storedToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
  }
  return storedToken;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => bootstrapAuthToken());
  const [loading, setLoading] = useState(true);

  // Check if user is admin based on is_admin field
  const isAdmin = user?.is_admin || false;

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use((config) => {
      const storedToken = getStoredToken();
      if (storedToken) {
        config.headers.Authorization = `Bearer ${storedToken}`;
      }
      // iOS Safari can serve stale JSON for catalog endpoints without a cache buster.
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
    const storedToken = getStoredToken();
    if (storedToken) {
      setToken(storedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get('/profile');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      clearStoredToken();
      setToken(null);
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  // Soft refresh — used after pay/cancel. Does not log the user out on failure.
  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const response = await axios.get<User>('/profile');
      setUser(response.data);
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
      persistToken(userToken, rememberMe);
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
      persistToken(userToken, true);
      axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    clearStoredToken();
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

