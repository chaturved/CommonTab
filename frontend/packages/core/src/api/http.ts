import type { ExpenseInput, GroupCreateInput, GroupSnapshot, Member, SettlementInput, WireExpense, WireSettlement } from '../types';
import { ApiError } from './errors';
import type { Api, Session } from './types';

/** The part of `fetch` we use, so core needs no DOM or Node types. */
export interface FetchResponse {
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<FetchResponse>;

export interface HttpApiOptions {
  baseUrl: string;
  fetch: FetchLike;
  /** Read on every call so a new sign-in is picked up at once. Never logged. */
  getToken: () => Promise<string | null> | string | null;
}

export class HttpApi implements Api {
  constructor(private readonly options: HttpApiOptions) {}

  private async call<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      const token = await this.options.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    let response: FetchResponse;
    try {
      response = await this.options.fetch(this.options.baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (error) {
      throw new ApiError(0, error instanceof Error ? error.message : 'Network request failed');
    }
    const text = await response.text();
    let json: Record<string, unknown> = {};
    if (text) {
      try { json = JSON.parse(text) as Record<string, unknown>; } catch { json = {}; }
    }
    if (response.status >= 200 && response.status < 300) return json as T;
    const retryHeader = Number(response.headers.get('Retry-After'));
    throw new ApiError(response.status, typeof json['detail'] === 'string' ? json['detail'] : `HTTP ${response.status}`,
      typeof json['code'] === 'string' ? json['code'] : null, {
        current: json['current'] as WireExpense | undefined,
        maxAmountMinor: typeof json['maxAmountMinor'] === 'number' ? json['maxAmountMinor'] : undefined,
        retryAfterSeconds: typeof json['retryAfterSeconds'] === 'number' ? json['retryAfterSeconds'] : Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined,
      });
  }

  register = (input: { email: string; name: string; password: string }) => this.call<Session>('POST', '/accounts', input, false);
  login = (input: { email: string; password: string }) => this.call<Session>('POST', '/auth/sessions', input, false);
  logout = () => this.call<void>('DELETE', '/auth/sessions');

  async healthy(): Promise<boolean> {
    try {
      await this.call('GET', '/healthz', undefined, false);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.isNetwork) throw error;
      return false;
    }
  }

  listGroups = () => this.call<GroupSnapshot[]>('GET', '/groups');
  createGroup = (input: GroupCreateInput) => this.call<GroupSnapshot>('POST', '/groups', input);
  putMember = (groupId: string, member: { id: string; name: string }) =>
    this.call<Member>('PUT', `/groups/${groupId}/members/${member.id}`, { name: member.name });
  putExpense = (groupId: string, expense: ExpenseInput) =>
    this.call<WireExpense>('PUT', `/groups/${groupId}/expenses/${expense.id}`, expense);
  deleteExpense = (groupId: string, expenseId: string) =>
    this.call<void>('DELETE', `/groups/${groupId}/expenses/${expenseId}`);
  createSettlement = (groupId: string, settlement: SettlementInput) =>
    this.call<WireSettlement>('POST', `/groups/${groupId}/settlements`, settlement);
}
