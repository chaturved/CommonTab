export type PinnedAction = 'how' | 'start';

export const PINNED_STEPS: { title: string; body: string; action: PinnedAction; label: string }[] = [
  { title: 'Settle up with fewer payments', body: 'Four friends, eleven expenses. CommonTab simplifies the group into the smallest set of payments, then clears the balance for everyone when you record one.', action: 'start', label: 'Get started free' },
  { title: 'Splits that add up exactly', body: 'Equal, exact, percent, or item by item. Every share adds up to the bill, to the cent.', action: 'how', label: 'See how it works' },
  { title: 'Works on a plane', body: 'Add expenses with no signal. They save on your phone first and sync when you reconnect. If two people edit the same one, you choose which version stays.', action: 'start', label: 'Get started free' },
  { title: 'Pay in euros, track in dollars', body: "Add an expense in euros to a dollar group. The rate is saved with it, so the balance doesn't move later.", action: 'how', label: 'See how it works' },
];

export const TALL_CARDS: { value: string; body: string; tone: 'mint' | 'light' | 'deep' | 'tint' }[] = [
  { value: 'K7Q\n4MX', body: 'Make a group, then share its code. Friends join in a tap.', tone: 'mint' },
  { value: '$54.50\neach', body: 'Add a bill. Dinner at Uchi, split three ways, adds up to $163.50.', tone: 'light' },
  { value: '4 → 2\npayments', body: 'Settle up. Simplify the group into the smallest set of payments.', tone: 'deep' },
  { value: '€120\n= $129.60', body: 'Any currency. The rate is saved with the expense.', tone: 'tint' },
];

export const DEVICE_CARDS: { value: string; body: string }[] = [
  { value: 'iPhone', body: 'Your groups, on your iPhone' },
  { value: 'Android', body: 'Your groups, on your Android phone' },
  { value: 'Web', body: 'Open it in your browser, nothing to install' },
];
