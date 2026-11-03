import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AmountText, Avatar, AvatarStack, avatarColorIndex, balanceWords, initials, ListRow } from '../src';

describe('AmountText: money is labeled, not only colored', () => {
  test('you owe', async () => {
    await render(<AmountText minorUnits={-1200} currency="USD" />);
    expect(screen.getByText('you owe')).toBeTruthy();
    expect(screen.getByText('$12.00')).toBeTruthy();
    expect(screen.getByLabelText('you owe $12.00')).toBeTruthy();
  });

  test("you're owed", async () => {
    await render(<AmountText minorUnits={10900} currency="USD" />);
    expect(screen.getByText("you're owed")).toBeTruthy();
    expect(screen.getByLabelText("you're owed $109.00")).toBeTruthy();
  });

  test('zero is settled up, never "owed"', async () => {
    await render(<AmountText minorUnits={0} currency="USD" />);
    expect(screen.getByText('settled up')).toBeTruthy();
    expect(screen.getByLabelText('settled up, $0.00')).toBeTruthy();
  });

  test('uses the currency', async () => {
    await render(<AmountText minorUnits={-123456} currency="JPY" />);
    expect(screen.getByText('¥123,456')).toBeTruthy();
  });

  test('plain amounts carry no direction', async () => {
    await render(<AmountText kind="plain" minorUnits={4200} currency="USD" />);
    expect(screen.getByLabelText('$42.00')).toBeTruthy();
    expect(screen.queryByText(/owe/)).toBeNull();
  });

  test.each([[-1, 'you owe'], [1, "you're owed"], [0, 'settled up']] as const)('balanceWords(%i)', (n, words) =>
    expect(balanceWords(n)).toBe(words));
});

describe('Avatar', () => {
  test.each([
    ['Chaturved Lakkaraju', 'CL'],
    ['Sam', 'SA'],
    ['riya k', 'RK'],
    ['  ', '?'],
    ['Mary Jane Watson', 'MW'],
  ])('initials(%p) = %s', (name, expected) => expect(initials(name)).toBe(expected));

  test('color is stable per id and within the palette', () => {
    expect(avatarColorIndex('abc')).toBe(avatarColorIndex('abc'));
    for (const key of ['a', 'b', 'c', 'uuid-1', 'uuid-2']) expect(avatarColorIndex(key)).toBeLessThan(5);
  });

  test('is labeled with the name', async () => {
    await render(<Avatar name="Sam Miller" />);
    expect(screen.getByLabelText('Sam Miller')).toBeTruthy();
  });

  test('stack lists every member to screen readers and folds the rest into one +N circle', async () => {
    const members = ['Ann', 'Ben', 'Cy', 'Di', 'Ed'].map((name) => ({ id: name, name }));
    await render(<AvatarStack members={members} />);
    expect(screen.getByLabelText('Members: Ann, Ben, Cy, Di, Ed')).toBeTruthy();
    expect(screen.getByText('+3', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('Cy')).toBeNull();
  });
});

describe('ListRow', () => {
  test('static row: min-height, labeled with title and subtitle', async () => {
    await render(<ListRow title="Austin Trip" subtitle="3 members" />);
    const row = screen.getByLabelText('Austin Trip, 3 members');
    expect(row.props.className).toContain('min-h-row');
    expect(row.props.className).not.toMatch(/(^| )h-\d/);
  });

  test('pressable row is a button', async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Apartment" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Apartment' }));
    expect(onPress).toHaveBeenCalled();
  });

  test('accessibilityLabel can put the trailing money into words', async () => {
    await render(
      <ListRow title="Apartment" subtitle="3 members" accessibilityLabel="Apartment, 3 members, you owe $12.00" trailing={<Text>$12.00</Text>} />,
    );
    expect(screen.getByLabelText('Apartment, 3 members, you owe $12.00')).toBeTruthy();
  });

  test('tall rows still use a minimum', async () => {
    await render(<ListRow title="Group" tall />);
    expect(screen.getByLabelText('Group').props.className).toContain('min-h-row-tall');
  });
});
