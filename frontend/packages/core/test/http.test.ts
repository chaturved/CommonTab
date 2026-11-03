import { ApiError, AuthSession, HttpApi, MemoryTokenStore, type FetchLike } from '../src';
import { FakeServer } from './fakeServer';
import { TestClock } from './support';

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | Error;

function client(replies: Reply[], token: string | null = 'secret-token') {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, ...init });
    const reply = replies.shift()!;
    if (reply instanceof Error) throw reply;
    return { status: reply.status, headers: { get: (n) => reply.headers?.[n] ?? null }, text: async () => (reply.body === undefined ? '' : JSON.stringify(reply.body)) };
  };
  return { calls, api: new HttpApi({ baseUrl: 'https://api.test', fetch, getToken: () => token }) };
}

const failure = async (promise: Promise<unknown>) => {
  try { await promise; } catch (error) { return error as ApiError; }
  throw new Error('expected a failure');
};

describe('HttpApi', () => {
  test('sends the bearer token and JSON, and returns the body', async () => {
    const { api, calls } = client([{ status: 200, body: { id: 'e' } }]);
    await api.putExpense('g', { id: 'e', merchant: 'm', occurredAt: 't', category: 'c', notes: '', amountMinor: 1, payerID: 'p', method: 'equal', participants: ['p'], values: [], version: null });
    expect(calls[0]).toMatchObject({ url: 'https://api.test/v1/groups/g/expenses/e', method: 'PUT', headers: { Authorization: 'Bearer secret-token', 'Content-Type': 'application/json' } });
  });

  test('calls go under /v1 and the health check does not', async () => {
    const { api, calls } = client([{ status: 200, body: {} }, { status: 200, body: {} }]);
    await api.listGroups();
    await api.healthy();
    expect(calls.map((c) => c.url)).toEqual(['https://api.test/v1/groups', 'https://api.test/healthz']);
  });

  test('sign-in and health calls carry no token', async () => {
    const { api, calls } = client([{ status: 200, body: {} }, { status: 200, body: {} }]);
    await api.login({ email: 'a@b.c', password: 'x' });
    await api.healthy();
    expect(calls.every((c) => c.headers['Authorization'] === undefined)).toBe(true);
  });

  test('no answer is status 0 and retryable', async () => {
    const { api } = client([new Error('Network request failed')]);
    const error = await failure(api.listGroups());
    expect(error).toMatchObject({ status: 0, isNetwork: true, isRetryable: true });
  });

  test('409 carries the code and the current record', async () => {
    const current = { id: 'e', version: 4 };
    const { api } = client([{ status: 409, body: { detail: 'Version conflict', code: 'version_conflict', current } }]);
    const error = await failure(api.deleteExpense('g', 'e'));
    expect(error).toMatchObject({ status: 409, code: 'version_conflict', extra: { current }, isRetryable: false });
  });

  test('422 exceeds_balance carries the most that can be paid', async () => {
    const { api } = client([{ status: 422, body: { detail: 'too much', code: 'exceeds_balance', maxAmountMinor: 500 } }]);
    expect(await failure(api.createSettlement('g', { id: 's', fromID: 'a', toID: 'b', amountMinor: 900 }))).toMatchObject({ code: 'exceeds_balance', maxAmountMinor: 500 });
  });

  test('429 reads Retry-After from the body or the header', async () => {
    const { api } = client([{ status: 429, body: { detail: 'slow', code: 'rate_limited', retryAfterSeconds: 12 } }, { status: 429, headers: { 'Retry-After': '7' } }]);
    expect((await failure(api.listGroups())).retryAfterMs).toBe(12_000);
    expect((await failure(api.listGroups())).retryAfterMs).toBe(7_000);
  });

  test('5xx is retryable and 401 is not', async () => {
    const { api } = client([{ status: 502 }, { status: 401, body: { detail: 'Not signed in' } }]);
    expect((await failure(api.listGroups())).isRetryable).toBe(true);
    expect((await failure(api.listGroups())).isRetryable).toBe(false);
  });

  test('healthy: true on 200, false on 503, throws when unreachable', async () => {
    const { api } = client([{ status: 200, body: { status: 'ok' } }, { status: 503, body: { status: 'unavailable' } }, new Error('down')]);
    expect(await api.healthy()).toBe(true);
    expect(await api.healthy()).toBe(false);
    await expect(api.healthy()).rejects.toMatchObject({ status: 0 });
  });
});

describe('AuthSession', () => {
  test('keeps the token in the token store and clears it on sign-out', async () => {
    const server = new FakeServer(new TestClock());
    server.signUp('Ada');
    const tokens = new MemoryTokenStore();
    const session = new AuthSession(server.api(() => null), tokens);
    const user = await session.signIn('ada@example.com', 'correct horse battery');
    expect(user.email).toBe('ada@example.com');
    expect(await tokens.get()).toMatch(/^token-/);
    await session.signOut();
    expect(await tokens.get()).toBeNull();
    expect(session.user).toBeNull();
  });

  describe('restore', () => {
    const cached = { id: 'u', email: 'cached@example.com', name: 'Cached' };

    test('a rejected token signs the user out', async () => {
      const server = new FakeServer(new TestClock());
      const tokens = new MemoryTokenStore();
      await tokens.set('stale');
      const session = new AuthSession(server.api(() => 'stale'), tokens);
      expect(await session.restore(cached)).toBeNull();
      expect(await tokens.get()).toBeNull();
    });

    test('offline keeps the cached user and the token', async () => {
      const tokens = new MemoryTokenStore();
      await tokens.set('t');
      const offline = new AuthSession({ me: async () => { throw new ApiError(0, 'offline'); } } as never, tokens);
      expect(await offline.restore(cached)).toEqual(cached);
      expect(await tokens.get()).toBe('t');
    });

    test('a valid token returns the server profile', async () => {
      const server = new FakeServer(new TestClock());
      const issued = server.signUp('Ada');
      const tokens = new MemoryTokenStore();
      await tokens.set(issued.accessToken);
      const session = new AuthSession(server.api(() => issued.accessToken), tokens);
      expect(await session.restore(null)).toMatchObject({ email: 'ada@example.com' });
    });
  });

  test('a wrong password is a 401 and stores nothing', async () => {
    const server = new FakeServer(new TestClock());
    server.signUp('Ada');
    const tokens = new MemoryTokenStore();
    const session = new AuthSession(server.api(() => null), tokens);
    await expect(session.signIn('ada@example.com', 'nope')).rejects.toMatchObject({ status: 401 });
    expect(await tokens.get()).toBeNull();
  });
});

describe('HttpApi in cookie mode', () => {
  const cookieClient = (replies: Reply[]) => {
    const calls: { url: string; method: string; headers: Record<string, string>; credentials?: string }[] = [];
    const fetch: FetchLike = async (url, init) => {
      calls.push({ url, ...init });
      const reply = replies.shift()! as Exclude<Reply, Error>;
      return { status: reply.status, headers: { get: () => null }, text: async () => (reply.body === undefined ? '' : JSON.stringify(reply.body)) };
    };
    return { calls, api: new HttpApi({ baseUrl: 'https://api.test', fetch, getToken: () => null, cookies: { clientHeader: 'web' } }) };
  };

  test('sends credentials always and the client header on writes only', async () => {
    const { api, calls } = cookieClient([{ status: 200, body: [] }, { status: 204 }]);
    await api.listGroups();
    await api.deleteExpense('g', 'e');
    expect(calls.map((c) => c.credentials)).toEqual(['include', 'include']);
    expect(calls[0]!.headers['X-CommonTab-Client']).toBeUndefined();
    expect(calls[1]!.headers['X-CommonTab-Client']).toBe('web');
    expect(calls[1]!.headers['Authorization']).toBeUndefined();
  });

  test('password reset, invite code, join and me hit their routes', async () => {
    const { api, calls } = cookieClient([{ status: 202, body: {} }, { status: 204 }, { status: 201, body: { code: 'ABCD-2345' } }, { status: 200, body: {} }, { status: 200, body: {} }]);
    await api.requestPasswordReset('a@b.c');
    await api.confirmPasswordReset({ email: 'a@b.c', code: 'ABCD-2345', newPassword: 'x'.repeat(15) });
    await api.createInviteCode('g', 'm');
    await api.joinWithCode('ABCD-2345');
    await api.me();
    expect(calls.map((c) => `${c.method} ${c.url.replace('https://api.test/v1', '')}`)).toEqual([
      'POST /auth/password-reset', 'POST /auth/password-reset/confirm', 'POST /groups/g/invite-code', 'POST /invitations/join', 'GET /me',
    ]);
  });
});
