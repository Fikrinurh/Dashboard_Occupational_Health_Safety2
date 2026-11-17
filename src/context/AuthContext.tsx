import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getStoredToken, setStoredToken, type MasterDataResponse } from '../services/api';
import type { AuthUser, SystemStatus, UserRole } from '../shared/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  systemStatus: SystemStatus | null;
  masterData: MasterDataResponse | null;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: (role: UserRole) => Promise<void>;
  logout: () => void;
  refreshMasterData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [masterData, setMasterData] = useState<MasterDataResponse | null>(null);

  const refreshMasterData = useCallback(async () => {
    try {
      const data = await api.getMasterData();
      setMasterData(data);
    } catch {
      // ignore if logged out
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const status = await api.getSystemStatus();
        if (!active) return;
        setSystemStatus(status);

        const params = new URLSearchParams(window.location.search);
        const autostart = params.get('autostart') === '1';
        const existingToken = getStoredToken();

        if (existingToken) {
          try {
            const me = await api.me();
            if (!active) return;
            setUser(me.user);
            setSystemStatus(me.systemStatus);
            const master = await api.getMasterData();
            if (active) setMasterData(master);
            return;
          } catch {
            setStoredToken(null);
          }
        }

        if (autostart && status.mode === 'DEMO_STORE') {
          const res = await api.demoLogin('ADMIN');
          if (!active) return;
          setStoredToken(res.token);
          setUser(res.user);
          setSystemStatus(res.systemStatus);
          const master = await api.getMasterData();
          if (active) setMasterData(master);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    setStoredToken(res.token);
    setUser(res.user);
    setSystemStatus(res.systemStatus);
    const master = await api.getMasterData();
    setMasterData(master);
  }, []);

  const demoLogin = useCallback(async (role: UserRole) => {
    const res = await api.demoLogin(role);
    setStoredToken(res.token);
    setUser(res.user);
    setSystemStatus(res.systemStatus);
    const master = await api.getMasterData();
    setMasterData(master);
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setMasterData(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        systemStatus,
        masterData,
        login,
        demoLogin,
        logout,
        refreshMasterData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
