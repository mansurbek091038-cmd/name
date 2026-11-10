import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Role, User } from '@/lib/types';

const RANK: Record<Role, number> = { manager: 1, admin: 2, super_admin: 3 };
export const hasRole = (u: User | null | undefined, min: Role) => !!u && RANK[u.role] >= RANK[min];
export const ROLE_LABEL: Record<Role, string> = { super_admin: 'Super admin', admin: 'Administrator', manager: 'Menejer' };

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string, otp?: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try { setUser(await api.get<User>('/auth/me')); } catch { setUser(null); }
    setReady(true);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const on = () => setUser(null);
    window.addEventListener('ss:auth-expired', on);
    return () => window.removeEventListener('ss:auth-expired', on);
  }, []);

  const login = useCallback(async (email: string, password: string, otp?: string) => {
    const res = await api.post<{ user: User; requires_2fa?: boolean }>('/auth/login', { email, password, otp: otp || undefined });
    if (res?.requires_2fa) throw new ApiError(401, 'OTP_REQUIRED', 'OTP');
    setUser(res.user);
    return res.user;
  }, []);
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, ready, login, logout, refresh, setUser }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}
