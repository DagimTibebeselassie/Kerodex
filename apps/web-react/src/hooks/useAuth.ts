import { useEffect, useState } from 'react';
import { ApiRequestError, clearSession, currentUser, KerodexUser, refreshCurrentUser } from '@/lib/api';

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
    if (currentUser()) {
      setIsLoading(true);
      refreshCurrentUser()
        .then(setUser)
        .catch(async (error) => {
          if (error instanceof ApiRequestError && error.status === 401) {
            await clearSession();
            setUser(null);
            return;
          }
          setUser(currentUser());
        })
        .finally(() => setIsLoading(false));
    }

    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('kerodex:auth-changed', refresh);
    };
  }, []);

  const requestLogin = () => {
    window.dispatchEvent(new CustomEvent('kerodex:auth-required', { detail: { tab: 'login' } }));
  };

  const logout = async () => {
    await clearSession();
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: requestLogin,
    logout,
  };
}
