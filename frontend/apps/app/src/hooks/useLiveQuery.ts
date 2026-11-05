import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import type { Services } from '@/services/createServices';

export function useLiveQuery<T>(load: (services: Services) => Promise<T>, initial: T): { ready: boolean; value: T } {
  const { services } = useApp();
  const [state, setState] = useState({ ready: false, value: initial });

  useEffect(() => {
    let live = true;
    const refresh = async () => {
      const value = await load(services);
      if (live) setState({ ready: true, value });
    };
    void refresh();
    const unsubscribe = services.engine.subscribe(() => void refresh());
    return () => {
      live = false;
      unsubscribe();
    };
  }, [services]);

  return state;
}
