import type { ExpenseInput, GroupCreateInput, GroupSnapshot, Member, SettlementInput, WireExpense, WireSettlement } from '../types';

export interface Session {
  accessToken: string;
  expiresAt: string;
  user: { id: string; email: string; name: string };
}

/**
 * The calls the app makes. Methods throw `ApiError`. `HttpApi` talks to the backend;
 * tests use a fake server with the same contract.
 */
export interface Api {
  register(input: { email: string; name: string; password: string }): Promise<Session>;
  login(input: { email: string; password: string }): Promise<Session>;
  logout(): Promise<void>;
  /** Returns whether the server and its database are up; used to tell "server down" from "no connection". */
  healthy(): Promise<boolean>;

  listGroups(): Promise<GroupSnapshot[]>;
  createGroup(input: GroupCreateInput): Promise<GroupSnapshot>;
  putMember(groupId: string, member: { id: string; name: string }): Promise<Member>;
  putExpense(groupId: string, expense: ExpenseInput): Promise<WireExpense>;
  deleteExpense(groupId: string, expenseId: string): Promise<void>;
  createSettlement(groupId: string, settlement: SettlementInput): Promise<WireSettlement>;
}
