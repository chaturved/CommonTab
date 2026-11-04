import { applyItemized, evaluateForm, evaluateItemized, expensesToCsv, newExpenseForm, tipSplit, type LocalExpense, type LocalGroup, type LocalSettlement } from '../src';

const group: LocalGroup = {
  id: 'g', name: 'Austin, "Trip"', currencyCode: 'USD', ownerID: 'me', meMemberID: 'me', version: 1,
  members: [{ id: 'me', name: 'Chaturved', userID: 'u', email: null }, { id: 'sam', name: 'Sam', userID: null, email: null }],
  syncState: 'synced', localOnly: false,
};
const expense = (over: Partial<LocalExpense>): LocalExpense => ({
  id: 'e', groupID: 'g', merchant: 'Dinner', occurredAt: '2026-10-30T18:00:00Z', category: 'dining', notes: '', amountMinor: 16350, payerID: 'me',
  method: 'equal', allocations: [{ memberID: 'me', minorUnits: 8175 }, { memberID: 'sam', minorUnits: 8175 }], values: [], version: 1, hasReceipt: false,
  updatedAt: '2026-10-30T18:00:00Z', deletedAt: null, syncState: 'synced', history: [], ...over,
});

describe('expensesToCsv', () => {
  test('one header, expenses oldest first, then payments, with money as plain decimals', () => {
    const payment: LocalSettlement = { id: 's', groupID: 'g', fromID: 'sam', toID: 'me', amountMinor: 5000, createdAt: '2026-11-02T10:00:00Z', syncState: 'synced' };
    const csv = expensesToCsv([{ group, expenses: [expense({ id: 'b', merchant: 'Brunch', occurredAt: '2026-10-29T10:00:00Z', payerID: 'sam', amountMinor: 5400 }), expense({})], settlements: [payment] }]);
    expect(csv.split('\r\n')).toEqual([
      'Group,Type,Date,Description,Category,Paid by,Paid to,Amount,Currency,Your share,Notes,Original amount,Original currency',
      '"Austin, ""Trip""",Expense,2026-10-29,Brunch,dining,Sam,,54.00,USD,81.75,,,',
      '"Austin, ""Trip""",Expense,2026-10-30,Dinner,dining,You,,163.50,USD,81.75,,,',
      '"Austin, ""Trip""",Payment,2026-11-02,,,Sam,You,50.00,USD,,,,',
      '',
    ]);
  });

  test('a foreign-currency expense lists the original amount and currency', () => {
    const csv = expensesToCsv([{ group, expenses: [expense({ amountMinor: 12960, currencyCode: 'EUR', originalMinor: 12000, rateMicros: 1_080_000 })], settlements: [] }]);
    expect(csv.split('\r\n')[1]).toMatch(/,129\.60,USD,81\.75,,120\.00,EUR$/);
  });

  test('deleted expenses are left out', () => {
    expect(expensesToCsv([{ group, expenses: [expense({ deletedAt: '2026-11-01T00:00:00Z' })], settlements: [] }]).split('\r\n')).toHaveLength(2);
  });

  test('a cell that starts like a formula is neutralised', () => {
    const csv = expensesToCsv([{ group, expenses: [expense({ merchant: '=HYPERLINK("x")', notes: 'line\nbreak' })], settlements: [] }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"line\nbreak"');
  });
});

describe('tipSplit', () => {
  test('$86.40 with a 20% tip between four is $103.68 and $25.92 each', () => {
    expect(tipSplit({ billMinor: 8640, tipPercent: '20', people: 4 })).toEqual({ billMinor: 8640, tipMinor: 1728, totalMinor: 10368, shares: [2592, 2592, 2592, 2592] });
  });

  test('shares always add up to the total, with the odd cents on the first people', () => {
    const result = tipSplit({ billMinor: 10000, tipPercent: '18', people: 3 });
    expect(result.totalMinor).toBe(11800);
    expect(result.shares).toEqual([3934, 3933, 3933]);
    expect(result.shares.reduce((a, b) => a + b, 0)).toBe(result.totalMinor);
  });

  test('the tip rounds half up', () => {
    expect(tipSplit({ billMinor: 1050, tipPercent: '15', people: 1 }).tipMinor).toBe(158);
  });

  test('no tip, and bad input', () => {
    expect(tipSplit({ billMinor: 5000, tipPercent: '0', people: 2 }).tipMinor).toBe(0);
    expect(() => tipSplit({ billMinor: 5000, tipPercent: '150', people: 2 })).toThrow();
    expect(() => tipSplit({ billMinor: 5000, tipPercent: '15', people: 0 })).toThrow();
    expect(() => tipSplit({ billMinor: -1, tipPercent: '15', people: 2 })).toThrow();
  });
});

describe('itemized bridge', () => {
  const people = ['me', 'sam', 'riya'];
  const input = {
    people,
    items: [
      { name: 'Ramen', priceText: '18.00', assignedTo: ['me'] },
      { name: 'Gyoza', priceText: '9.00', assignedTo: ['sam', 'riya'] },
      { name: 'Sake', priceText: '24.00', assignedTo: ['sam'] },
      { name: 'Ice cream', priceText: '8.40', assignedTo: ['me', 'riya'] },
    ],
    taxText: '', tipPercent: '0',
  };

  test('each person pays their items; the shares add up to the receipt', () => {
    const outcome = evaluateItemized(input, 'USD');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.subtotal).toBe(5940);
    expect(outcome.result.shares.map((s) => [s.personID, s.total])).toEqual([['me', 2220], ['sam', 2850], ['riya', 870]]);
    expect(outcome.result.shares.reduce((a, s) => a + s.total, 0)).toBe(outcome.result.total);
  });

  test('tax and tip are shared in proportion and the total stays exact', () => {
    const outcome = evaluateItemized({ ...input, taxText: '4.50', tipPercent: '20' }, 'USD');
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.result.total).toBe(5940 + 450 + 1188);
    expect(outcome.result.shares.reduce((a, s) => a + s.total, 0)).toBe(outcome.result.total);
  });

  test('says what is wrong in words', () => {
    expect(evaluateItemized({ ...input, items: [] }, 'USD')).toEqual({ ok: false, message: 'Add at least one item.' });
    expect(evaluateItemized({ ...input, items: [{ name: 'Tea', priceText: '3', assignedTo: [] }] }, 'USD')).toEqual({ ok: false, message: 'Pick who had Tea.' });
    expect(evaluateItemized({ ...input, items: [{ name: '', priceText: '3', assignedTo: ['me'] }] }, 'USD')).toEqual({ ok: false, message: 'Give every item a name.' });
    expect(evaluateItemized({ ...input, items: [{ name: 'Tea', priceText: 'x', assignedTo: ['me'] }] }, 'USD').ok).toBe(false);
  });

  test('applying it to the form makes an exact split that checks out', () => {
    const outcome = evaluateItemized(input, 'USD');
    if (!outcome.ok) throw new Error(outcome.message);
    const form = applyItemized({ ...newExpenseForm({ id: 'g', name: 'G', currencyCode: 'USD', ownerID: 'me', meMemberID: 'me', version: 1, members: [{ id: 'me', name: 'A', userID: null, email: null }], syncState: 'synced', localOnly: false }, Date.now()), merchant: 'Ramen night' }, outcome.result, 'USD');
    expect(form).toMatchObject({ method: 'exact', amountText: '59.40', participants: ['me', 'sam', 'riya'], amounts: { me: '22.20', sam: '28.50', riya: '8.70' } });
    expect(evaluateForm(form, 'USD').split).toBeNull();
  });
});
