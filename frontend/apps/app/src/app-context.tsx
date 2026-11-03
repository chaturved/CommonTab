import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { SignedInUser } from '@commontab/core';
import { createServices, type Services } from './services';

interface AppValue {
  services: Services;
  user: SignedInUser | null;
  signIn(email: string, password: string): Promise<void>;
  register(email: string, name: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AppContext = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp needs <AppProvider>');
  return value;
}

export function AppProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [services, setServices] = useState<Services | null>(null);
  const [user, setUser] = useState<SignedInUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const created = await createServices();
      const restored = await created.auth.restore(await created.cachedUser());
      await created.rememberUser(restored);
      if (cancelled) return;
      setServices(created);
      setUser(restored);
    })();
    return () => { cancelled = true; };
  }, []);

  const signedIn = user !== null;
  useEffect(() => {
    if (!services || !signedIn) return;
    void services.engine.sync();
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') void services.engine.sync(); });
    const online = () => void services.engine.sync();
    globalThis.addEventListener?.('online', online);
    return () => {
      app.remove();
      globalThis.removeEventListener?.('online', online);
    };
  }, [services, signedIn]);

  const accept = useCallback(async (next: SignedInUser) => {
    await services!.rememberUser(next);
    services!.engine.resume();
    setUser(next);
  }, [services]);

  const value = useMemo<AppValue | null>(() => services && {
    services,
    user,
    signIn: async (email, password) => accept(await services.auth.signIn(email, password)),
    register: async (email, name, password) => accept(await services.auth.register(email, name, password)),
    signOut: async () => {
      await services.auth.signOut();
      await services.clearLocalData();
      setServices(await createServices());
      setUser(null);
    },
  }, [services, user, accept]);

  return value ? <AppContext.Provider value={value}>{children}</AppContext.Provider> : <>{fallback}</>;
}
