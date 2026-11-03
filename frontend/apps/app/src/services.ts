import { randomUUID } from 'expo-crypto';
import {
  Actions, AuthSession, HttpApi, PersistentStorage, SyncEngine,
  type Api, type SignedInUser, type Storage,
} from '@commontab/core';
import { API_URL, CLIENT_HEADER } from './config';
import { openDriver } from './platform/driver';
import { tokenStore, usesCookies } from './platform/tokens';

const USER_KEY = 'user';

export interface Services {
  api: Api;
  auth: AuthSession;
  storage: Storage;
  engine: SyncEngine;
  actions: Actions;
  clearLocalData(): Promise<void>;
  rememberUser(user: SignedInUser | null): Promise<void>;
  cachedUser(): Promise<SignedInUser | null>;
}

export async function createServices(): Promise<Services> {
  const driver = await openDriver();
  const storage = await PersistentStorage.open(driver);
  const clock = { now: () => Date.now() };
  const random = { uuid: () => randomUUID(), next: () => Math.random() };
  const api = new HttpApi({
    baseUrl: API_URL,
    fetch: (url, init) => fetch(url, init),
    getToken: () => tokenStore.get(),
    cookies: usesCookies ? { clientHeader: CLIENT_HEADER } : undefined,
  });
  const engine = new SyncEngine({ storage, api, clock, random });
  return {
    api, storage, engine,
    auth: new AuthSession(api, tokenStore),
    actions: new Actions({ storage, clock, random, notify: engine.notify }),
    clearLocalData: () => driver.clear(),
    rememberUser: async (user) => storage.setMeta(USER_KEY, JSON.stringify(user)),
    cachedUser: async () => {
      const raw = await storage.getMeta(USER_KEY);
      return raw ? (JSON.parse(raw) as SignedInUser | null) : null;
    },
  };
}
