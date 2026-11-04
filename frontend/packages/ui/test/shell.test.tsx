import { fireEvent, render, screen } from '@testing-library/react-native';
import { Activity, CircleUser, House, Users } from 'lucide-react-native';
import { Text } from 'react-native';
import { Hero, Sheet, TabBar } from '../src';

const tabs = [
  { key: 'home', label: 'Home', icon: House },
  { key: 'groups', label: 'Groups', icon: Users },
  { key: 'activity', label: 'Activity', icon: Activity },
  { key: 'account', label: 'Account', icon: CircleUser },
];

describe('TabBar', () => {
  test('has Home, Groups, Add, Activity, Account in that order', async () => {
    await render(<TabBar tabs={tabs} activeKey="home" onSelect={() => {}} onAdd={() => {}} />);
    const labels = [...screen.getAllByRole('tab'), ...screen.getAllByRole('button')].map((n) => n.props.accessibilityLabel);
    expect(labels).toEqual(['Home', 'Groups', 'Activity', 'Account', 'Add expense']);
  });

  test('selected tab is announced as selected', async () => {
    await render(<TabBar tabs={tabs} activeKey="groups" onSelect={() => {}} onAdd={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Groups' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('tab', { name: 'Home' }).props.accessibilityState).toMatchObject({ selected: false });
  });

  test('onSelect and onAdd fire', async () => {
    const onSelect = jest.fn();
    const onAdd = jest.fn();
    await render(<TabBar tabs={tabs} activeKey="home" onSelect={onSelect} onAdd={onAdd} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Activity' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));
    expect(onSelect).toHaveBeenCalledWith('activity');
    expect(onAdd).toHaveBeenCalled();
  });

  test('every tab meets the 44pt minimum', async () => {
    await render(<TabBar tabs={tabs} activeKey="home" onSelect={() => {}} onAdd={() => {}} />);
    for (const tab of screen.getAllByRole('tab')) expect(tab.props.className).toContain('min-h-touch');
  });
});

describe('Sheet', () => {
  test('shows title and content when visible, and closes from the scrim', async () => {
    const onClose = jest.fn();
    await render(
      <Sheet visible onClose={onClose} title="Session expired">
        <Text>Sign in again to keep syncing.</Text>
      </Sheet>,
    );
    expect(screen.getByText('Session expired')).toBeTruthy();
    expect(screen.getByText('Sign in again to keep syncing.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sheet-scrim', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('is a modal view that screen readers can escape', async () => {
    const onClose = jest.fn();
    await render(<Sheet visible onClose={onClose} title="Delete expense"><Text>x</Text></Sheet>);
    const sheet = screen.getByLabelText('Delete expense');
    expect(sheet.props.accessibilityViewIsModal).toBe(true);
    sheet.props.onAccessibilityEscape();
    expect(onClose).toHaveBeenCalled();
  });

  test('renders nothing when hidden', async () => {
    await render(<Sheet visible={false} onClose={() => {}} title="Hidden"><Text>x</Text></Sheet>);
    expect(screen.queryByText('Hidden')).toBeNull();
  });
});

test('Hero renders its children', async () => {
  await render(<Hero><Text>$97.00</Text></Hero>);
  expect(screen.getByText('$97.00')).toBeTruthy();
});
