import { useEffect, useState } from 'react';
import { clearSession, currentUser, KerodexUser } from '@/lib/api';

export function useAuth() {
  const [user, setUser] = useState<KerodexUser | null>(() => currentUser());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setUser(currentUser());
      setIsLoading(false);
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('kerodex:auth-changed', refresh);
    refresh();

    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('kerodex:auth-changed', refresh);
    };
  }, []);

  const requestLogin = () => {
    window.dispatchEvent(new CustomEvent('kerodex:auth-required', { detail: { tab: 'login' } }));
  };

  const logout = () => {
    clearSession();
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: requestLogin,
    logout,
  };
}
