export type PinnedAction = 'how' | 'start';

export const PINNED_STEPS: { title: string; body: string; action: PinnedAction; label: string }[] = [
  { title: 'Splits that add up exactly', body: 'Money is stored in whole cents, so a share is never off by a penny. Equal, exact, percent, or item by item.', action: 'how', label: 'See how it works' },
  { title: 'Keeps working offline', body: 'Everything saves on your phone first and syncs when you reconnect. If two people edit the same expense, you choose which version stays.', action: 'start', label: 'Get started free' },
  { title: 'Any currency, one group', body: "Add an expense in euros to a dollar group. The rate is saved with it, so the balance doesn't move later.", action: 'how', label: 'See how it works' },
  { title: 'Settle up with fewer payments', body: 'Simplify a group into the smallest set of payments, then record a payment and the balance clears for everyone.', action: 'start', label: 'Get started free' },
];

export const TALL_CARDS: { value: string; body: string; tone: 'mint' | 'light' | 'deep' | 'tint' }[] = [
  { value: '$54.50\neach', body: 'Dinner at Uchi, split three ways. Adds up to $163.50.', tone: 'mint' },
  { value: '2\nwaiting', body: 'Brunch and Taxi are saved on your phone and will sync.', tone: 'light' },
  { value: '€120\n= $129.60', body: 'The rate is saved with the expense.', tone: 'deep' },
  { value: '4 → 2\npayments', body: 'Simplify a group into the smallest set of payments.', tone: 'tint' },
];

export const STATS: { value: string; body: string }[] = [
  { value: 'Whole\ncents', body: 'Every share adds back to the bill' },
  { value: '3\ndevices', body: 'iPhone, Android and web' },
  { value: 'Offline', body: 'Add expenses with no signal' },
];
