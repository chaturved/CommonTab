import { checkSettlement, directionWith, halfOf, settleLimit, type LocalGroup } from '../src';

const group: LocalGroup = {
  id: 'g', name: 'Austin Trip', currencyCode: 'USD', ownerID: 'me', meMemberID: 'me', version: 1,
  members: [{ id: 'me', name: 'Chaturved', userID: 'u', email: null }, { id: 'sam', name: 'Sam', userID: null, email: null }, { id: 'riya', name: 'Riya', userID: null, email: null }],
  syncState: 'synced', localOnly: false,
};
const balances = [{ memberID: 'me', minorUnits: 10900 }, { memberID: 'sam', minorUnits: -5450 }, { memberID: 'riya', minorUnits: -5450 }];

describe('settleLimit', () => {
  test('is the smaller of what the payer owes and what the payee is owed', () => {
    expect(settleLimit(balances, 'sam', 'me')).toBe(5450);
    expect(settleLimit([{ memberID: 'a', minorUnits: 1000 }, { memberID: 'b', minorUnits: -4000 }, { memberID: 'c', minorUnits: 3000 }], 'b', 'a')).toBe(1000);
  });

  test('is zero the wrong way round or between two who owe', () => {
    expect(settleLimit(balances, 'me', 'sam')).toBe(0);
    expect(settleLimit(balances, 'sam', 'riya')).toBe(0);
  });
});

describe('directionWith', () => {
  test('Sam owes me, so Sam pays me', () => {
    expect(directionWith(balances, 'me', 'sam')).toEqual({ fromID: 'sam', toID: 'me', limit: 5450 });
  });

  test('I owe Sam, so I pay Sam', () => {
    const mine = [{ memberID: 'me', minorUnits: -1200 }, { memberID: 'sam', minorUnits: 1200 }];
    expect(directionWith(mine, 'me', 'sam')).toEqual({ fromID: 'me', toID: 'sam', limit: 1200 });
  });

  test('nobody owes anyone: no direction', () => {
    expect(directionWith([{ memberID: 'me', minorUnits: 0 }, { memberID: 'sam', minorUnits: 0 }], 'me', 'sam')).toBeNull();
  });
});

describe('checkSettlement', () => {
  const direction = directionWith(balances, 'me', 'sam');

  test('the full balance and part of it are fine', () => {
    expect(checkSettlement({ amountText: '54.50', direction, group })).toEqual({ ok: true, amountMinor: 5450 });
    expect(checkSettlement({ amountText: '10', direction, group })).toEqual({ ok: true, amountMinor: 1000 });
  });

  test('more than owed is refused with the most that can be paid, like the server', () => {
    expect(checkSettlement({ amountText: '60', direction, group })).toEqual({ ok: false, message: "That's more than is owed. The most Sam can pay you is $54.50." });
  });

  test('empty, zero and nonsense are refused', () => {
    for (const amountText of ['', '0', 'abc', '1.234']) expect(checkSettlement({ amountText, direction, group }).ok).toBe(false);
  });

  test('no direction says nobody owes anything', () => {
    expect(checkSettlement({ amountText: '5', direction: null, group })).toEqual({ ok: false, message: 'Nobody owes anything between these two people.' });
  });

  test('half rounds down so two halves never exceed the balance', () => {
    expect(halfOf(5450)).toBe(2725);
    expect(halfOf(5451)).toBe(2725);
  });
});
