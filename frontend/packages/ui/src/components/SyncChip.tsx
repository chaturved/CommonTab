import { Pressable, View } from 'react-native';
import { CircleAlert, Clock, Check, RefreshCw } from 'lucide-react-native';
import { cx } from '../theme';
import { Icon } from './Icon';
import { Text, TextTone } from './Text';

export type SyncState =
  | { kind: 'synced' }
  | { kind: 'syncing' }
  | { kind: 'waiting'; count: number }
  | { kind: 'failed' };

export interface SyncChipProps {
  state: SyncState;
  /** Opens the Sync screen. When omitted the chip is a read-only status. */
  onPress?: () => void;
  className?: string;
}

/** Visible text and screen-reader text for each state. Driven by the outbox, not by reachability. */
export function syncText(state: SyncState): { text: string; spoken: string } {
  switch (state.kind) {
    case 'synced':
      return { text: 'Synced', spoken: 'Everything is synced' };
    case 'syncing':
      return { text: 'Syncing…', spoken: 'Syncing your changes' };
    case 'waiting':
      return {
        text: `${state.count} waiting`,
        spoken: `${state.count} ${state.count === 1 ? 'change is' : 'changes are'} waiting to sync`,
      };
    case 'failed':
      return { text: "Couldn't sync", spoken: "Couldn't sync some changes" };
  }
}

const BOX = { synced: 'bg-tint', syncing: 'bg-tint', waiting: 'bg-warn', failed: 'bg-owe-tint' } as const;
const ICON = { synced: 'on-tint', syncing: 'on-tint', waiting: 'on-warn', failed: 'owe' } as const;
const TONE: Record<SyncState['kind'], TextTone> = { synced: 'on-tint', syncing: 'on-tint', waiting: 'on-warn', failed: 'owe' };

export function SyncChip({ state, onPress, className }: SyncChipProps) {
  const glyph = { synced: Check, syncing: RefreshCw, waiting: Clock, failed: CircleAlert }[state.kind];
  const { text, spoken } = syncText(state);
  const chip = (
    <View className={cx('h-8 flex-row items-center gap-1.5 self-start rounded-pill px-3', BOX[state.kind], className)}>
      <Icon icon={glyph} size={14} strokeWidth={2.6} tone={ICON[state.kind]} />
      <Text variant="caption" tone={TONE[state.kind]} className="font-bold">
        {text}
      </Text>
    </View>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityRole="text" accessibilityLabel={spoken}>
        {chip}
      </View>
    );
  }
  // The chip is 32 high; the hit area is padded to the 44pt minimum.
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${spoken}. Open sync status`} onPress={onPress} hitSlop={6} className="min-h-touch justify-center">
      {chip}
    </Pressable>
  );
}
