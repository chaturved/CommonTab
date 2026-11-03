import { Pressable, View } from 'react-native';
import { Clock, Check } from 'lucide-react-native';
import { formatCurrency, type GroupSummary } from '@commontab/core';
import { AmountText, AvatarStack, Icon, Pill, Text } from '@commontab/ui';
import type { GroupData } from '../data';
import { useIsDesktop } from '../layout';

export function waitingText(count: number): string {
  return `${count} ${count === 1 ? 'change' : 'changes'} waiting to sync`;
}

export function GroupCard({ data, offline, onPress, detail }: { data: GroupData; offline?: boolean; onPress: () => void; detail?: boolean }) {
  const desktop = useIsDesktop();
  const { group, summary } = data;
  const subtitle = summary.waiting > 0 ? null : offline ? 'Up to date' : detail ? summary.memberNames.join(', ') : `${summary.memberCount} ${summary.memberCount === 1 ? 'member' : 'members'}`;
  const spoken = `${group.name}, ${summary.memberCount} members, ${spokenBalance(summary)}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={spoken} onPress={onPress} className="overflow-hidden rounded-card bg-card active:opacity-80">
      <View className="min-h-row-tall flex-row items-center gap-3.5 px-4 py-3">
        <AvatarStack className="w-[76px]" members={group.members.map((m) => ({ id: m.id, name: m.name }))} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="body" className="font-semibold" numberOfLines={1}>{group.name}</Text>
          {summary.waiting > 0 ? (
            <View className="flex-row items-center gap-1">
              <Icon icon={Clock} size={13} strokeWidth={2.4} tone="warn-icon" />
              <Text variant="caption" tone="on-warn" className="text-[13px]">{waitingText(summary.waiting)}</Text>
            </View>
          ) : (
            <Text variant="caption" tone="muted" className="text-[13px]" numberOfLines={1}>{subtitle}</Text>
          )}
        </View>
        {summary.status === 'settled' ? (
          <Pill label="Settled" tone="accent" icon={<Icon icon={Check} size={13} strokeWidth={2.6} tone="on-tint" />} />
        ) : (
          <AmountText minorUnits={summary.myBalance} currency={summary.currencyCode} />
        )}
      </View>
      {detail && summary.counterparts.length > 0 ? (
        desktop ? (
          <View className="flex-row flex-wrap gap-2 px-[18px] pb-4">
            {summary.counterparts.map((c) => (
              <View key={c.memberID} className="rounded-xl bg-background px-2.5 py-1.5">
                <Text variant="body-small" className="text-[13px]">{counterpartText(c, summary)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="gap-1 border-t border-divider px-4 py-2.5">
            {summary.counterparts.map((c) => (
              <Text key={c.memberID} variant="body-small" tone="fg-soft" className="text-[14px]">{counterpartText(c, summary)}</Text>
            ))}
          </View>
        )
      ) : null}
    </Pressable>
  );
}

function spokenBalance(summary: GroupSummary): string {
  if (summary.status === 'settled') return 'settled';
  const amount = formatCurrency(Math.abs(summary.myBalance), summary.currencyCode);
  return summary.myBalance < 0 ? `you owe ${amount}` : summary.myBalance > 0 ? `you're owed ${amount}` : 'settled up';
}

function counterpartText(c: GroupSummary['counterparts'][number], summary: GroupSummary): string {
  const amount = formatCurrency(c.minorUnits, summary.currencyCode);
  return c.direction === 'owesMe' ? `${c.name} owes you ${amount}` : `You owe ${c.name} ${amount}`;
}
