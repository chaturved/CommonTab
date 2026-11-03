import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { Banner, SyncChip, setAppearance, syncText, useThemeColors } from '../src';

describe('Banner', () => {
  test('warning is a status with title and message', async () => {
    await render(<Banner title="You're offline." message="Changes are saved on this phone and sync when you're back." />);
    const banner = screen.getByRole('status');
    expect(banner.props.accessibilityLabel).toBe("You're offline. Changes are saved on this phone and sync when you're back.");
    expect(screen.getByText("You're offline.", { exact: false })).toBeTruthy();
  });

  test('error is announced as an alert', async () => {
    await render(<Banner tone="error" message="Couldn't reach the server." />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  test('rows grow with large text: min-height, no fixed height', async () => {
    await render(<Banner message="x" />);
    const className = screen.getByRole('status').props.className as string;
    expect(className).toContain('min-h-touch');
    expect(className).not.toMatch(/(^| )h-\d/);
  });
});

describe('syncText', () => {
  test.each([
    [{ kind: 'synced' }, 'Synced'],
    [{ kind: 'syncing' }, 'Syncing…'],
    [{ kind: 'waiting', count: 3 }, '3 waiting'],
    [{ kind: 'failed' }, "Couldn't sync"],
  ] as const)('%j -> %s', (state, text) => expect(syncText(state).text).toBe(text));

  test('spoken text pluralizes', () => {
    expect(syncText({ kind: 'waiting', count: 1 }).spoken).toBe('1 change is waiting to sync');
    expect(syncText({ kind: 'waiting', count: 2 }).spoken).toBe('2 changes are waiting to sync');
  });
});

describe('SyncChip', () => {
  test('is read-only text without onPress', async () => {
    await render(<SyncChip state={{ kind: 'waiting', count: 2 }} />);
    expect(screen.getByText('2 waiting')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('2 changes are waiting to sync')).toBeTruthy();
  });

  test('with onPress it is a labeled button with a 44pt target', async () => {
    const onPress = jest.fn();
    await render(<SyncChip state={{ kind: 'failed' }} onPress={onPress} />);
    const button = screen.getByRole('button', { name: "Couldn't sync some changes. Open sync status" });
    expect(button.props.className).toContain('min-h-touch');
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('appearance override', () => {
  function Probe() {
    return <RNText testID="probe">{useThemeColors().scheme}</RNText>;
  }

  afterEach(() => act(() => setAppearance('system')));

  test('choosing dark or light wins over the system, and system gives control back', async () => {
    await render(<Probe />);
    await act(async () => setAppearance('dark'));
    expect(screen.getByTestId('probe').props.children).toBe('dark');
    await act(async () => setAppearance('light'));
    expect(screen.getByTestId('probe').props.children).toBe('light');
  });
});
