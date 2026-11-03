import type { ExpenseInput, GroupCreateInput, GroupSnapshot, Member, SettlementInput, WireExpense, WireSettlement } from '../types';

export interface Session {
  accessToken: string;
  expiresAt: string;
  user: { id: string; email: string; name: string };
}

export interface Profile { id: string; email: string; name: string }

export interface InviteCode { code: string; expiresAt: string; groupID: string; memberID: string | null }

export interface Api {
  register(input: { email: string; name: string; password: string }): Promise<Session>;
  login(input: { email: string; password: string }): Promise<Session>;
  logout(): Promise<void>;
  me(): Promise<Profile>;
  renameMe(name: string): Promise<Profile>;
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
  deleteAccount(password: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  confirmPasswordReset(input: { email: string; code: string; newPassword: string }): Promise<void>;
  healthy(): Promise<boolean>;

  listGroups(): Promise<GroupSnapshot[]>;
  createGroup(input: GroupCreateInput): Promise<GroupSnapshot>;
  putMember(groupId: string, member: { id: string; name: string }): Promise<Member>;
  putExpense(groupId: string, expense: ExpenseInput): Promise<WireExpense>;
  deleteExpense(groupId: string, expenseId: string): Promise<void>;
  createInviteCode(groupId: string, memberId?: string): Promise<InviteCode>;
  joinWithCode(code: string): Promise<GroupSnapshot>;
  createSettlement(groupId: string, settlement: SettlementInput): Promise<WireSettlement>;
}
