import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button, Card, Pill, Text } from '../src';

describe('Button', () => {
  test('is a labeled button and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Add expense" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('accessibilityLabel overrides the visible label', async () => {
    await render(<Button label="Pay" accessibilityLabel="Pay Sam $12.00" />);
    expect(screen.getByRole('button', { name: 'Pay Sam $12.00' })).toBeTruthy();
  });

  test('disabled and loading buttons do not fire and say so', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" disabled onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  });

  test('loading is announced as busy', async () => {
    await render(<Button label="Save" loading />);
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  test.each([
    ['large', 'min-h-button'],
    ['small', 'min-h-button-small'],
  ] as const)('%s size uses min-height, never a fixed height', async (size, cls) => {
    await render(<Button label="Go" size={size} />);
    const className = screen.getByRole('button').props.className as string;
    expect(className).toContain(cls);
    expect(className).not.toMatch(/(^| )h-\d/);
  });

  test('ghost buttons still meet the 44pt target', async () => {
    await render(<Button label="Create group" variant="ghost" />);
    expect(screen.getByRole('button').props.className).toContain('min-h-touch');
  });
});

describe('Text', () => {
  test('label variant is uppercase with tracking', async () => {
    await render(<Text variant="label">What changed</Text>);
    const node = screen.getByText('What changed');
    expect(node.props.className).toContain('uppercase');
    expect(node.props.style[0].letterSpacing).toBeCloseTo(1.04);
  });

  test('exactly one color class, chosen by tone', async () => {
    await render(<Text tone="muted">x</Text>);
    const classes = (screen.getByText('x').props.className as string).split(' ');
    expect(classes.filter((c) => /^text-(fg|muted|accent)/.test(c))).toEqual(['text-muted']);
  });
});

test('Card renders children on a card surface', async () => {
  await render(<Card testID="card"><Text>Inside</Text></Card>);
  expect(screen.getByTestId('card').props.className).toContain('bg-card');
  expect(screen.getByText('Inside')).toBeTruthy();
});

test('Pill shows its label', async () => {
  await render(<Pill label="3 members" tone="neutral" />);
  expect(screen.getByText('3 members')).toBeTruthy();
});
