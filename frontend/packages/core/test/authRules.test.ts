import { ApiError, describeAuthFailure, looksLikeEmail, passwordProgress } from '../src';

describe('passwordProgress', () => {
  test('counts characters toward 15 and says how many are missing', () => {
    expect(passwordProgress('sunnyday-12')).toMatchObject({ length: 11, missing: 4, complete: false });
    expect(passwordProgress('sunnyday-12').fraction).toBeCloseTo(11 / 15);
  });

  test('15 characters is complete and the bar never passes full', () => {
    expect(passwordProgress('a'.repeat(15))).toMatchObject({ missing: 0, fraction: 1, complete: true });
    expect(passwordProgress('a'.repeat(40)).fraction).toBe(1);
  });

  test('over 128 characters is not complete', () => {
    expect(passwordProgress('a'.repeat(129)).complete).toBe(false);
  });

  test('counts a character, not a UTF-16 unit', () => {
    expect(passwordProgress('😀'.repeat(15)).complete).toBe(true);
  });
});

describe('looksLikeEmail', () => {
  test.each([['a@b.co', true], [' a@b.co ', true], ['a@b', false], ['a b@c.de', false], ['', false]])('%s', (value, expected) => {
    expect(looksLikeEmail(value)).toBe(expected);
  });
});

describe('describeAuthFailure', () => {
  const fail = (status: number, code: string | null = null, retry?: number) => new ApiError(status, 'x', code, { retryAfterSeconds: retry });

  test('no answer is the offline message, worded for the action', () => {
    expect(describeAuthFailure(fail(0), 'signIn')).toMatchObject({ kind: 'offline', title: "You're offline" });
    expect(describeAuthFailure(fail(0), 'resetRequest').message).toMatch(/Resetting a password/);
  });

  test.each([
    [401, null, 'signIn', 'wrongCredentials'],
    [409, null, 'register', 'emailTaken'],
    [400, 'invalid_code', 'resetConfirm', 'wrongCode'],
    [422, null, 'register', 'invalid'],
    [503, null, 'signIn', 'unavailable'],
  ] as const)('%i %s on %s is %s', (status, code, action, kind) => {
    expect(describeAuthFailure(fail(status, code), action).kind).toBe(kind);
  });

  test('429 says how long to wait', () => {
    expect(describeAuthFailure(fail(429, 'rate_limited', 12), 'signIn').message).toBe('Too many tries. Wait 12 seconds and try again.');
  });

  test('a 401 on a different action is not called a wrong password', () => {
    expect(describeAuthFailure(fail(401), 'register').kind).toBe('unknown');
  });

  test('a wrong current password says so, and is not treated as a session problem', () => {
    expect(describeAuthFailure(fail(403, 'wrong_password'), 'changePassword')).toEqual({ kind: 'wrongPassword', message: "That password isn't right." });
    expect(describeAuthFailure(fail(403, 'wrong_password'), 'deleteAccount').kind).toBe('wrongPassword');
  });

  test('changing the password offline says it needs a connection', () => {
    expect(describeAuthFailure(fail(0), 'changePassword').message).toMatch(/needs an internet connection/);
  });

  test('anything else is the generic message', () => {
    expect(describeAuthFailure(new Error('boom'), 'signIn')).toMatchObject({ kind: 'unknown' });
  });
});
