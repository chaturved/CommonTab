import { ApiError, type SyncStatus } from '@commontab/core';
import { capAmountText, currencySymbol, decimalOnly, percentOnly } from '@/lib/amountInput';
import { dayOffset } from '@/lib/dates';
import { explainGroupError } from '@/lib/groupErrors';
import { syncLabel } from '@/lib/syncLabel';

describe('decimalOnly', () => {
  it('keeps digits and a single decimal point', () => {
    expect(decimalOnly('1a2.3.4,5')).toBe('12.345');
    expect(decimalOnly('')).toBe('');
    expect(decimalOnly('.5')).toBe('.5');
  });
});

describe('percentOnly', () => {
  it('caps a share at 100 and keeps two decimals', () => {
    expect(percentOnly('200')).toBe('100');
    expect(percentOnly('100.5')).toBe('100');
    expect(percentOnly('33.333')).toBe('33.33');
    expect(percentOnly('25')).toBe('25');
    expect(percentOnly('')).toBe('');
  });
});

describe('capAmountText', () => {
  it('stops one person owing more than the expense total', () => {
    expect(capAmountText('200', 16350, 'USD')).toBe('163.50');
    expect(capAmountText('80.25', 16350, 'USD')).toBe('80.25');
    expect(capAmountText('163.50', 16350, 'USD')).toBe('163.50');
  });
  it('does not cap while the amount is empty or half typed', () => {
    expect(capAmountText('999', null, 'USD')).toBe('999');
    expect(capAmountText('12.', 16350, 'USD')).toBe('12.');
    expect(capAmountText('', 16350, 'USD')).toBe('');
  });
});

describe('currencySymbol', () => {
  it('returns the symbol without digits', () => {
    expect(currencySymbol('USD')).toBe('$');
  });
});

describe('dayOffset', () => {
  it('formats a date as YYYY-MM-DD relative to today', () => {
    const today = dayOffset(0);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const diff = (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${dayOffset(-1)}T12:00:00Z`)) / 86_400_000;
    expect(diff).toBe(1);
  });
});

describe('syncLabel', () => {
  const status = (over: Partial<SyncStatus>): SyncStatus => ({ connectivity: 'online', chip: 'synced', waiting: 0, lastSyncedAt: null, ...over }) as SyncStatus;
  it('describes each state', () => {
    expect(syncLabel(null, 0)).toBe('Syncing…');
    expect(syncLabel(status({ connectivity: 'offline' }), 0)).toBe('Offline');
    expect(syncLabel(status({ connectivity: 'sessionExpired' }), 0)).toBe('Sign in again to sync');
    expect(syncLabel(status({ chip: 'waiting', waiting: 3 }), 0)).toBe('3 waiting to sync');
    expect(syncLabel(status({ lastSyncedAt: 1000 }), 20_000)).toBe('Synced just now');
  });
});

describe('explainGroupError', () => {
  it('turns unknown errors into a generic message', () => {
    expect(explainGroupError(new Error('boom'))).toEqual({ ok: false, message: 'Something went wrong. Try again.' });
  });
  it('explains an owed balance', () => {
    const error = new ApiError(409, 'owes', 'owes_balance', { balanceMinor: 500 });
    const result = explainGroupError(error);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ message: 'Settle up before leaving.' });
  });
});
