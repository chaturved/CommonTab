import * as SecureStore from 'expo-secure-store';
import type { TokenStore } from '@commontab/core';

const KEY = 'commontab.accessToken';

export const tokenStore: TokenStore = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token) => SecureStore.setItemAsync(KEY, token),
  clear: () => SecureStore.deleteItemAsync(KEY),
};

export const usesCookies = false;
