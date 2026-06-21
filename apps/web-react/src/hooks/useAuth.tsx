import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiRequestError, clearSession, currentUser, KerodexUser, refreshCurrentUser } from '@/lib/api';

interface AuthContextValue {
  user: KerodexUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
let initialUserRefresh: Promise<KerodexUser | null> | null = null;

function refreshInitialUserOnce() {
  const cachedUser = currentUser();
  if (!cachedUser) return Promise.resolve(null);
  if (!initialUserRefresh) {
    initialUserRefresh = refreshCurrentUser().catch(async (error) => {
      if (error instanceof ApiRequestError && error.status === 401) {
        await clearSession();
        return null;
      }
      return currentUser();
    });
  }
  return initialUserRefresh;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<KerodexUser | null>(() => currentUser());
  const [isLoading, setIsLoading] = useState(() => Boolean(currentUser()));

  useEffect(() => {
    let active = true;
    const syncFromStorage = () => {
      if (active) setUser(currentUser());
    };
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('kerodex:auth-changed', syncFromStorage);

    refreshInitialUserOnce()
      .then((nextUser) => {
        if (active) setUser(nextUser);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('kerodex:auth-changed', syncFromStorage);
    };
  }, []);

  const requestLogin = useCallback(() => {
    window.dispatchEvent(new CustomEvent('kerodex:auth-required', { detail: { tab: 'login' } }));
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    login: requestLogin,
    logout,
  }), [isLoading, logout, requestLogin, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
