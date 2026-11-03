import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { SignedInUser } from '@commontab/core';
import { setAppearance, type AppearanceMode } from '@commontab/ui';
import { createServices, type Services } from './services';

interface AppValue {
  services: Services;
  user: SignedInUser | null;
  signIn(email: string, password: string): Promise<void>;
  register(email: string, name: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  setPendingJoinCode(code: string | null): void;
  resetLocalData(): Promise<void>;
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
  const pendingCode = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const created = await createServices();
      const restored = await created.auth.restore(await created.cachedUser());
      await created.rememberUser(restored);
      if (cancelled) return;
      const saved = await created.getPref('appearance');
      if (saved === 'light' || saved === 'dark' || saved === 'system') setAppearance(saved as AppearanceMode);
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
    globalThis.addEventListener?.('offline', online);
    return () => {
      app.remove();
      globalThis.removeEventListener?.('online', online);
      globalThis.removeEventListener?.('offline', online);
    };
  }, [services, signedIn]);

  const accept = useCallback(async (next: SignedInUser) => {
    await services!.rememberUser(next);
    services!.engine.resume();
    setUser(next);
    const code = pendingCode.current;
    if (code) {
      pendingCode.current = null;
      void services!.api.joinWithCode(code).then(() => services!.engine.sync()).catch(() => undefined);
    }
  }, [services]);

  const value = useMemo<AppValue | null>(() => services && {
    services,
    user,
    signIn: async (email, password) => accept(await services.auth.signIn(email, password)),
    register: async (email, name, password) => accept(await services.auth.register(email, name, password)),
    setPendingJoinCode: (code) => { pendingCode.current = code; },
    resetLocalData: async () => {
      const keep = { appearance: await services.getPref('appearance'), currency: await services.getPref('currency') };
      await services.clearLocalData();
      const fresh = await createServices();
      if (user) await fresh.rememberUser(user);
      if (keep.appearance) await fresh.setPref('appearance', keep.appearance);
      if (keep.currency) await fresh.setPref('currency', keep.currency);
      setServices(fresh);
    },
    signOut: async () => {
      await services.auth.signOut();
      await services.clearLocalData();
      setServices(await createServices());
      setUser(null);
    },
  }, [services, user, accept]);

  return value ? <AppContext.Provider value={value}>{children}</AppContext.Provider> : <>{fallback}</>;
}
