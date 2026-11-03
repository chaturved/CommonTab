import { ApiError } from '../api/errors';

export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;

export interface PasswordProgress {
  length: number;
  missing: number;
  fraction: number;
  complete: boolean;
}

export function passwordProgress(password: string): PasswordProgress {
  const length = [...password].length;
  const missing = Math.max(0, MIN_PASSWORD_LENGTH - length);
  return {
    length,
    missing,
    fraction: Math.min(1, length / MIN_PASSWORD_LENGTH),
    complete: missing === 0 && length <= MAX_PASSWORD_LENGTH,
  };
}

export const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export type AuthAction = 'signIn' | 'register' | 'resetRequest' | 'resetConfirm';

export interface AuthFailure {
  kind: 'offline' | 'wrongCredentials' | 'emailTaken' | 'wrongCode' | 'rateLimited' | 'invalid' | 'unavailable' | 'unknown';
  title?: string;
  message: string;
}

export function describeAuthFailure(error: unknown, action: AuthAction): AuthFailure {
  if (!(error instanceof ApiError)) return { kind: 'unknown', message: 'Something went wrong. Try again.' };
  if (error.isNetwork) {
    return {
      kind: 'offline',
      title: "You're offline",
      message: action === 'signIn' || action === 'register'
        ? 'Signing in the first time needs an internet connection. After that, CommonTab works offline.'
        : 'Resetting a password needs an internet connection.',
    };
  }
  if (error.status === 429) {
    const seconds = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
    return { kind: 'rateLimited', message: `Too many tries. Wait ${seconds} ${seconds === 1 ? 'second' : 'seconds'} and try again.` };
  }
  if (error.status >= 500) return { kind: 'unavailable', message: "CommonTab can't be reached right now. Try again in a moment." };
  if (action === 'signIn' && error.status === 401) return { kind: 'wrongCredentials', message: "That email and password don't match." };
  if (action === 'register' && error.status === 409) return { kind: 'emailTaken', message: 'An account with this email already exists. Try signing in.' };
  if (action === 'resetConfirm' && error.code === 'invalid_code') {
    return { kind: 'wrongCode', message: 'That code is wrong or has expired. Check it, or ask for a new one.' };
  }
  if (error.status === 422) return { kind: 'invalid', message: 'Check the details and try again.' };
  return { kind: 'unknown', message: 'Something went wrong. Try again.' };
}
