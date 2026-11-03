import {
  allocate, ApiError, type Api, type ActivityEvent, type Clock, type ExpenseInput, type GroupCreateInput, type GroupSnapshot, type GroupStub, type Member,
  type Session, type SettlementInput, type WireExpense, type WireSettlement,
} from '../src';

interface Group {
  id: string; name: string; currencyCode: string; ownerID: string; version: number;
  members: Member[]; expenses: Map<string, WireExpense>; settlements: WireSettlement[];
}

const sameContent = (a: WireExpense, b: ExpenseInput, allocations: WireExpense['allocations']) =>
  a.deletedAt === null && a.merchant === b.merchant && a.occurredAt === b.occurredAt && a.category === b.category &&
  a.notes === b.notes && a.amountMinor === b.amountMinor && a.payerID === b.payerID && a.method === b.method &&
  JSON.stringify(a.allocations) === JSON.stringify(allocations) && JSON.stringify(a.values) === JSON.stringify(b.values);

const notSimulated = async (): Promise<never> => { throw new Error('not simulated by the fake server'); };

export class FakeServer {
  groups = new Map<string, Group>();
  private users = new Map<string, { id: string; email: string; name: string; password: string }>();
  private tokens = new Map<string, string>();
  private counter = 0;

  offline = false;
  activityLog: ActivityEvent[] = [];
  closed = new Map<string, { status: 'removed' | 'deleted'; since: string }>();
  unhealthy = false;
  dropResponses = 0;
  failNext: { status: number; code?: string; extra?: Record<string, unknown> }[] = [];
  afterNextWrite: (() => Promise<void>) | null = null;
  log: string[] = [];

  constructor(private readonly clock: Clock) {}

  private now = () => new Date(this.clock.now()).toISOString();

  signUp(name: string, email = `${name.toLowerCase()}@example.com`): Session {
    const id = `user-${++this.counter}`;
    this.users.set(email, { id, email, name, password: 'correct horse battery' });
    return this.issue(id, email, name);
  }

  private issue(id: string, email: string, name: string): Session {
    const accessToken = `token-${++this.counter}`;
    this.tokens.set(accessToken, id);
    return { accessToken, expiresAt: '2099-01-01T00:00:00Z', user: { id, email, name } };
  }

  expire(token: string) { this.tokens.delete(token); }

  api(getToken: () => string | null): Api {
    const guard = async <T>(label: string, write: boolean, work: (userId: string) => T): Promise<T> => {
      if (this.offline) throw new ApiError(0, 'offline');
      this.log.push(label);
      const fail = this.failNext.shift();
      if (fail) throw new ApiError(fail.status, 'forced', fail.code ?? null, fail.extra);
      const userId = this.tokens.get(getToken() ?? '');
      if (!userId) throw new ApiError(401, 'Not signed in');
      const result = work(userId);
      if (write && this.afterNextWrite) {
        const hook = this.afterNextWrite;
        this.afterNextWrite = null;
        await hook();
      }
      if (write && this.dropResponses > 0) {
        this.dropResponses--;
        throw new ApiError(0, 'connection lost');
      }
      return result;
    };
    return {
      register: async ({ email, name, password }) => { void password; return this.signUp(name, email); },
      login: async ({ email, password }) => {
        const user = this.users.get(email);
        if (!user || user.password !== password) throw new ApiError(401, 'Wrong email or password');
        return this.issue(user.id, user.email, user.name);
      },
      logout: async () => { this.tokens.delete(getToken() ?? ''); },
      me: async () => {
        const user = [...this.users.values()].find((u) => this.tokens.get(getToken() ?? '') === u.id);
        if (!user) throw new ApiError(401, 'Not signed in');
        return { id: user.id, email: user.email, name: user.name };
      },
      activity: async (since) => ({ events: this.activityLog.filter((e) => e.seq > since), next: this.activityLog.at(-1)?.seq ?? since }),
      renameMe: notSimulated,
      changePassword: notSimulated,
      deleteAccount: notSimulated,
      requestPasswordReset: notSimulated,
      confirmPasswordReset: notSimulated,
      leaveGroup: notSimulated,
      removeMember: notSimulated,
      archiveGroup: notSimulated,
      unarchiveGroup: notSimulated,
      deleteGroup: notSimulated,
      createInviteCode: notSimulated,
      revokeInviteCodes: notSimulated,
      joinWithCode: notSimulated,
      healthy: async () => {
        if (this.offline) throw new ApiError(0, 'offline');
        return !this.unhealthy;
      },
      listGroups: () => guard('GET /groups', false, (u) => [...this.groups.values()].filter((g) => this.me(g, u) && !this.closed.has(g.id)).map((g): GroupSnapshot | GroupStub => this.snapshot(g, u)).concat(this.stubs())),
      createGroup: (input) => guard('POST /groups', true, (u) => this.createGroup(u, input)),
      putMember: (groupId, member) => guard(`PUT member ${member.id}`, true, (u) => this.putMember(u, groupId, member)),
      putExpense: (groupId, expense) => guard(`PUT expense ${expense.id}`, true, (u) => this.putExpense(u, groupId, expense)),
      deleteExpense: (groupId, expenseId) => guard(`DELETE expense ${expenseId}`, true, (u) => this.deleteExpense(u, groupId, expenseId)),
      createSettlement: (groupId, settlement) => guard(`POST settlement ${settlement.id}`, true, (u) => this.createSettlement(u, groupId, settlement)),
    };
  }

  private stubs(): GroupStub[] {
    return [...this.closed].map(([id, c]) => ({ id, name: this.groups.get(id)?.name ?? 'Group', status: c.status, since: c.since }));
  }

  private me(group: Group, userId: string) { return group.members.find((m) => m.userID === userId); }

  private require(userId: string, groupId: string): Group {
    const group = this.groups.get(groupId);
    if (!group || !this.me(group, userId)) throw new ApiError(404, 'Not found', 'not_found');
    return group;
  }

  private balances(group: Group): Map<string, number> {
    const totals = new Map(group.members.map((m) => [m.id, 0]));
    const add = (id: string, n: number) => totals.set(id, (totals.get(id) ?? 0) + n);
    for (const e of group.expenses.values()) {
      if (e.deletedAt) continue;
      add(e.payerID, e.amountMinor);
      for (const a of e.allocations) add(a.memberID, -a.minorUnits);
    }
    for (const s of group.settlements) { add(s.fromID, s.amountMinor); add(s.toID, -s.amountMinor); }
    return totals;
  }

  snapshot(group: Group, userId: string): GroupSnapshot {
    const all = [...group.expenses.values()];
    return {
      id: group.id, name: group.name, currencyCode: group.currencyCode, ownerID: group.ownerID,
      meMemberID: this.me(group, userId)!.id, version: group.version, members: group.members.map((m) => ({ ...m })),
      expenses: all.filter((e) => !e.deletedAt).map((e) => ({ ...e })), deletedExpenses: all.filter((e) => e.deletedAt).map((e) => ({ ...e })),
      settlements: group.settlements.map((s) => ({ ...s })),
      balances: [...this.balances(group)].map(([memberID, minorUnits]) => ({ memberID, minorUnits })),
    };
  }

  private createGroup(userId: string, input: GroupCreateInput): GroupSnapshot {
    const existing = this.groups.get(input.id);
    const user = [...this.users.values()].find((u) => u.id === userId)!;
    if (existing) {
      if (!this.me(existing, userId)) throw new ApiError(409, 'id taken', 'id_conflict');
      return this.snapshot(existing, userId);
    }
    const members: Member[] = input.members.map((m) => ({ id: m.id, name: m.name, userID: m.id === input.meMemberID ? userId : null, email: m.id === input.meMemberID ? user.email : null }));
    const group: Group = { id: input.id, name: input.name, currencyCode: input.currencyCode, ownerID: input.meMemberID, version: 1, members, expenses: new Map(), settlements: [] };
    this.groups.set(group.id, group);
    return this.snapshot(group, userId);
  }

  private putMember(userId: string, groupId: string, member: { id: string; name: string }): Member {
    const group = this.require(userId, groupId);
    const existing = group.members.find((m) => m.id === member.id);
    if (existing) { if (existing.name !== member.name) { existing.name = member.name; group.version++; } return { ...existing }; }
    const added: Member = { id: member.id, name: member.name, userID: null, email: null };
    group.members.push(added);
    group.version++;
    return { ...added };
  }

  private putExpense(userId: string, groupId: string, input: ExpenseInput): WireExpense {
    const group = this.require(userId, groupId);
    const allocations = allocate({ method: input.method === 'percentage' ? 'percent' : input.method, amount: input.amountMinor, participants: input.participants, values: input.values });
    const stored = group.expenses.get(input.id);
    const write = (version: number): WireExpense => {
      const record: WireExpense = {
        id: input.id, groupID: groupId, merchant: input.merchant, occurredAt: input.occurredAt, category: input.category, notes: input.notes,
        amountMinor: input.amountMinor, payerID: input.payerID, method: input.method, allocations, values: input.values, version,
        hasReceipt: false, updatedAt: this.now(), deletedAt: null,
      };
      group.expenses.set(record.id, record);
      group.version++;
      return { ...record };
    };
    if (!stored) return write(1);
    if (sameContent(stored, input, allocations)) return { ...stored };
    const conflict = () => new ApiError(409, 'Version conflict', 'version_conflict', { current: { ...stored } });
    if (stored.deletedAt) {
      if (input.version === stored.version) return write(stored.version + 1);
      throw conflict();
    }
    if (input.version !== stored.version) throw conflict();
    return write(stored.version + 1);
  }

  private deleteExpense(userId: string, groupId: string, expenseId: string): void {
    const group = this.require(userId, groupId);
    const stored = group.expenses.get(expenseId);
    if (!stored || stored.deletedAt) return;
    group.expenses.set(expenseId, { ...stored, deletedAt: this.now(), updatedAt: this.now(), version: stored.version + 1 });
    group.version++;
  }

  private createSettlement(userId: string, groupId: string, input: SettlementInput): WireSettlement {
    const group = this.require(userId, groupId);
    const stored = group.settlements.find((s) => s.id === input.id);
    if (stored) {
      if (stored.fromID === input.fromID && stored.toID === input.toID && stored.amountMinor === input.amountMinor) return { ...stored };
      throw new ApiError(409, 'id used for a different payment', 'id_conflict');
    }
    const totals = this.balances(group);
    const owes = -(totals.get(input.fromID) ?? 0);
    const owed = totals.get(input.toID) ?? 0;
    const max = Math.max(0, Math.min(owes, owed));
    if (input.amountMinor <= 0 || input.amountMinor > max) throw new ApiError(422, 'Amount exceeds what is owed', 'exceeds_balance', { maxAmountMinor: max });
    const settlement: WireSettlement = { id: input.id, groupID: groupId, fromID: input.fromID, toID: input.toID, amountMinor: input.amountMinor, createdAt: this.now() };
    group.settlements.push(settlement);
    group.version++;
    return { ...settlement };
  }
}
