import {
  addDifferenceTo, balanceChangeNote, expenseChanges, balanceChanges, evaluateForm, formFromExpense, newExpenseForm, splitIssueMessage, splitRestEqually,
  switchMethod, toggleParticipant, type ExpenseForm, type LocalExpense, type LocalGroup,
} from '../src';

const group: LocalGroup = {
  id: 'g', name: 'Austin Trip', currencyCode: 'USD', ownerID: 'me', meMemberID: 'me', version: 1,
  members: [{ id: 'me', name: 'Chaturved', userID: 'u', email: null }, { id: 'sam', name: 'Sam', userID: null, email: null }, { id: 'riya', name: 'Riya', userID: null, email: null }],
  syncState: 'synced', localOnly: false,
};
const order = group.members.map((m) => m.id);
const NOW = new Date(2026, 9, 30, 20, 31).getTime();

const filled = (over: Partial<ExpenseForm> = {}): ExpenseForm => ({ ...newExpenseForm(group, NOW), merchant: 'Dinner at Uchi', amountText: '163.50', ...over });

describe('newExpenseForm', () => {
  test('starts with you as payer, everyone splitting equally, today', () => {
    expect(newExpenseForm(group, NOW)).toMatchObject({ payerID: 'me', participants: order, method: 'equal', date: '2026-10-30', category: 'dining' });
  });
});

describe('evaluateForm', () => {
  test('an equal split of $163.50 gives each person $54.50', () => {
    const result = evaluateForm(filled(), 'USD');
    expect(result.errors).toEqual({});
    expect(result.shares.map((s) => s.minorUnits)).toEqual([5450, 5450, 5450]);
    expect(result.draft).toMatchObject({ merchant: 'Dinner at Uchi', amountMinor: 16350, method: 'equal', values: [], occurredAt: '2026-10-30T12:00:00.000Z' });
  });

  test('$100.00 over three people is 33.34 / 33.33 / 33.33 and sums to the total', () => {
    const result = evaluateForm(filled({ amountText: '100' }), 'USD');
    expect(result.shares.map((s) => s.minorUnits)).toEqual([3334, 3333, 3333]);
  });

  test('says what is missing, and gives no draft', () => {
    const result = evaluateForm(filled({ merchant: '  ', amountText: '', participants: [], date: '30/10/2026' }), 'USD');
    expect(result.errors).toEqual({ merchant: 'Add a description', amount: 'Enter an amount', participants: 'Pick at least one person', date: 'Use the format YYYY-MM-DD' });
    expect(result.draft).toBeNull();
  });

  test('rejects zero, too many decimals, and impossible dates', () => {
    expect(evaluateForm(filled({ amountText: '0' }), 'USD').errors.amount).toBeDefined();
    expect(evaluateForm(filled({ amountText: '1.234' }), 'USD').errors.amount).toBeDefined();
    expect(evaluateForm(filled({ date: '2026-02-30' }), 'USD').errors.date).toBeDefined();
  });

  test('works in a currency with no decimals', () => {
    expect(evaluateForm(filled({ amountText: '1500' }), 'JPY').draft?.amountMinor).toBe(1500);
  });

  describe('exact', () => {
    const exact = (amounts: Record<string, string>) => filled({ method: 'exact', amounts });

    test('shares that add up are accepted and sent as minor units', () => {
      const result = evaluateForm(exact({ me: '80', sam: '40', riya: '43.50' }), 'USD');
      expect(result.split).toBeNull();
      expect(result.draft).toMatchObject({ method: 'exact', values: ['8000', '4000', '4350'] });
    });

    test('short by $3.50 is reported with the difference', () => {
      const result = evaluateForm(exact({ me: '80', sam: '40', riya: '40' }), 'USD');
      expect(result.split).toEqual({ kind: 'short', diffMinor: 350 });
      expect(result.draft).toBeNull();
      expect(splitIssueMessage(result.split!, 'USD', 16350, result.shares)).toBe('Amounts add up to $160.00. $3.50 short of the total.');
    });

    test('over the total is reported too', () => {
      const result = evaluateForm(exact({ me: '100', sam: '40', riya: '40' }), 'USD');
      expect(result.split).toEqual({ kind: 'over', diffMinor: 1650 });
    });

    test('a blank share counts as zero, a bad one is invalid', () => {
      expect(evaluateForm(exact({ me: '163.50' }), 'USD').split).toBeNull();
      expect(evaluateForm(exact({ me: 'abc', sam: '1', riya: '1' }), 'USD').split?.kind).toBe('invalid');
    });

    test('"Add $3.50 to Riya" fixes the split', () => {
      const form = exact({ me: '80', sam: '40', riya: '40' });
      const fixed = addDifferenceTo(form, 'riya', 'USD', evaluateForm(form, 'USD').split!);
      expect(fixed.amounts['riya']).toBe('43.50');
      expect(evaluateForm(fixed, 'USD').split).toBeNull();
    });

    test('"Split the rest equally" shares the shortfall and keeps the total exact', () => {
      const form = exact({ me: '80', sam: '40', riya: '40' });
      const fixed = splitRestEqually(form, 'USD', evaluateForm(form, 'USD').split!);
      expect(fixed.amounts).toEqual({ me: '81.17', sam: '41.17', riya: '41.16' });
      expect(evaluateForm(fixed, 'USD').split).toBeNull();
    });

    test('taking from an over-allocated person does not go below zero', () => {
      const form = exact({ me: '10', sam: '1', riya: '160' });
      const issue = evaluateForm(form, 'USD').split!;
      expect(addDifferenceTo(form, 'sam', 'USD', issue)).toBe(form);
    });
  });

  describe('percent', () => {
    const percent = (percents: Record<string, string>) => filled({ method: 'percent', percents, amountText: '100' });

    test('100% total is accepted and sent as percentage', () => {
      const result = evaluateForm(percent({ me: '50', sam: '25', riya: '25' }), 'USD');
      expect(result.draft).toMatchObject({ method: 'percentage', values: ['50', '25', '25'] });
      expect(result.shares.map((s) => s.minorUnits)).toEqual([5000, 2500, 2500]);
    });

    test('98% is not enough and says so', () => {
      const result = evaluateForm(percent({ me: '50', sam: '25', riya: '23' }), 'USD');
      expect(result.split).toEqual({ kind: 'percent', diffMinor: 0, percentTotal: '98' });
      expect(splitIssueMessage(result.split!, 'USD', 10000, result.shares)).toBe('Percentages add up to 98%. They need to add up to 100%.');
    });

    test('decimals add up exactly', () => {
      expect(evaluateForm(percent({ me: '33.4', sam: '33.3', riya: '33.3' }), 'USD').split).toBeNull();
    });

    test('empty percentages are invalid', () => {
      expect(evaluateForm(percent({ me: '50' }), 'USD').split?.kind).toBe('invalid');
    });
  });
});

describe('switching the split', () => {
  test('equal to exact keeps what everyone was going to pay', () => {
    const exact = switchMethod(filled(), 'exact', 'USD');
    expect(exact.amounts).toEqual({ me: '54.50', sam: '54.50', riya: '54.50' });
    expect(evaluateForm(exact, 'USD').split).toBeNull();
  });

  test('equal to percent starts even and adds up to 100', () => {
    const percent = switchMethod(filled(), 'percent', 'USD');
    expect(percent.percents).toEqual({ me: '33.34', sam: '33.33', riya: '33.33' });
    expect(evaluateForm(percent, 'USD').split).toBeNull();
  });

  test('toggling a person keeps the group order', () => {
    const without = toggleParticipant(filled(), 'sam', order);
    expect(without.participants).toEqual(['me', 'riya']);
    expect(toggleParticipant(without, 'sam', order).participants).toEqual(order);
  });
});

describe('editing an existing expense', () => {
  const stored: LocalExpense = {
    id: 'e', groupID: 'g', merchant: 'Dinner at Uchi', occurredAt: '2026-10-30T18:00:00Z', category: 'dining', notes: '', amountMinor: 16000,
    payerID: 'me', method: 'exact', allocations: [{ memberID: 'me', minorUnits: 8000 }, { memberID: 'sam', minorUnits: 8000 }], values: ['8000', '8000'],
    version: 2, hasReceipt: false, updatedAt: '2026-10-30T18:00:00Z', deletedAt: null, syncState: 'synced', history: [],
  };

  test('the form shows the saved values and re-saves to the same thing', () => {
    const form = formFromExpense(stored, 'USD');
    expect(form).toMatchObject({ amountText: '160.00', date: '2026-10-30', method: 'exact', participants: ['me', 'sam'], amounts: { me: '80.00', sam: '80.00' } });
    expect(evaluateForm(form, 'USD').draft).toMatchObject({ amountMinor: 16000, values: ['8000', '8000'], method: 'exact' });
  });

  test('says how balances change: $160 to $170 split between two moves Sam by $5.00', () => {
    const before = { payerID: 'me', amountMinor: 16000, allocations: stored.allocations };
    const after = { payerID: 'me', amountMinor: 17000, allocations: [{ memberID: 'me', minorUnits: 8500 }, { memberID: 'sam', minorUnits: 8500 }] };
    const changes = balanceChanges(group, before, after);
    expect(changes.map((c) => [c.name, c.deltaMinor])).toEqual([['You', 500], ['Sam', -500]]);
    expect(balanceChangeNote(changes, 'me', 'USD')).toBe('Balances for Sam will change by $5.00.');
  });

  test('several people with the same change read "each"', () => {
    const before = { payerID: 'me', amountMinor: 9000, allocations: [{ memberID: 'me', minorUnits: 3000 }, { memberID: 'sam', minorUnits: 3000 }, { memberID: 'riya', minorUnits: 3000 }] };
    const after = { payerID: 'me', amountMinor: 12000, allocations: [{ memberID: 'me', minorUnits: 4000 }, { memberID: 'sam', minorUnits: 4000 }, { memberID: 'riya', minorUnits: 4000 }] };
    expect(balanceChangeNote(balanceChanges(group, before, after), 'me', 'USD')).toBe('Balances for Sam and Riya will change by $10.00 each.');
  });

  test('different changes do not claim an amount', () => {
    const before = { payerID: 'me', amountMinor: 9000, allocations: [{ memberID: 'me', minorUnits: 3000 }, { memberID: 'sam', minorUnits: 3000 }, { memberID: 'riya', minorUnits: 3000 }] };
    const after = { payerID: 'me', amountMinor: 9000, allocations: [{ memberID: 'me', minorUnits: 3000 }, { memberID: 'sam', minorUnits: 4000 }, { memberID: 'riya', minorUnits: 2000 }] };
    expect(balanceChangeNote(balanceChanges(group, before, after), 'me', 'USD')).toBe('Balances for Sam and Riya will change.');
  });

  test('no note when only you are affected', () => {
    expect(balanceChangeNote([{ memberID: 'me', name: 'You', deltaMinor: 100 }], 'me', 'USD')).toBeNull();
  });
});

describe('expenseChanges', () => {
  const theirs = { merchant: 'Dinner at Uchi', amountMinor: 17000, payerID: 'me', occurredAt: '2026-10-30T18:00:00Z', category: 'dining', method: 'equal' as const, allocations: [{ memberID: 'me', minorUnits: 8500 }, { memberID: 'sam', minorUnits: 8500 }] };
  const mine = { id: 'e', groupID: 'g', merchant: 'Dinner at Uchi', occurredAt: '2026-10-30T18:00:00Z', category: 'dining', notes: '', amountMinor: 16350, payerID: 'me', method: 'equal' as const, participants: ['me', 'sam'], values: [], allocations: [{ memberID: 'me', minorUnits: 8175 }, { memberID: 'sam', minorUnits: 8175 }], editedAt: '2026-10-30T20:42:00Z'};

  test('lists only what differs, with both sides in words', () => {
    const changes = expenseChanges(mine as never, theirs, group);
    expect(changes.map((c) => c.field)).toEqual(['amount', 'split']);
    expect(changes[0]).toMatchObject({ label: 'Amount', mine: '$163.50', theirs: '$170.00' });
  });

  test('nothing differs, nothing listed', () => {
    expect(expenseChanges({ ...mine, amountMinor: 17000, allocations: theirs.allocations } as never, theirs, group)).toEqual([]);
  });
});
