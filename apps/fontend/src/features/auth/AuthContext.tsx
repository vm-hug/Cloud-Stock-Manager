import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile, Role } from '@cloud-stock/shared';
import { authApi } from './auth.api';
import { api } from '../../lib/api';

interface AuthContextType {
  user: UserProfile | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    passwordPlain: string
  ) => Promise<{ success: boolean; role?: Role; error?: string }>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (nextUser: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session on page mount: prioritize tab-scoped accessToken first for multi-tab role isolation
  const initSession = useCallback(async () => {
    try {
      if (api.getAccessToken()) {
        const meRes = await authApi.getMe();
        if (meRes.success && meRes.data) {
          setUser(meRes.data);
          return;
        }
      }

      const res = await authApi.refresh();
      if (res.success && res.data?.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  useEffect(() => {
    if (user?.role) {
      document.documentElement.dataset.role = user.role;
    } else {
      delete document.documentElement.dataset.role;
    }
  }, [user?.role]);

  const login = async (email: string, passwordPlain: string) => {
    try {
      const res = await authApi.login(email, passwordPlain);
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        return { success: true, role: res.data.user.role };
      }
      return {
        success: false,
        error: res.error?.message || 'Login failed. Please check your credentials.',
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown network error',
      };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  const logoutAll = async () => {
    setIsLoading(true);
    try {
      await authApi.logoutAll();
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.data) {
        setUser(res.data);
      }
    } catch {
      // Ignore
    }
  };

  const updateUser = useCallback((nextUser: UserProfile) => {
    setUser(nextUser);
  }, []);

  const value: AuthContextType = {
    user,
    role: user?.role || null,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
    logoutAll,
    refreshUser,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
