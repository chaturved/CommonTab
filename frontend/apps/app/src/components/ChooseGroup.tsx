import { View } from 'react-native';
import { Pressable } from 'react-native';
import { timeAgo } from '@commontab/core';
import { AmountText, AvatarStack, Button, Card, Text } from '@commontab/ui';
import type { GroupData } from '../data';

const lastActivity = (g: GroupData) => g.expenses.reduce((latest, e) => Math.max(latest, Date.parse(e.updatedAt)), 0);

export function ChooseGroup({ groups, onPick, onCreate, hideHeading }: { groups: GroupData[]; onPick: (id: string) => void; onCreate: () => void; hideHeading?: boolean }) {
  const ordered = [...groups].sort((a, b) => lastActivity(b) - lastActivity(a) || a.group.name.localeCompare(b.group.name));
  const now = Date.now();
  return (
    <View className="gap-4">
      <View className="gap-1 px-2 pt-2">
        {hideHeading ? null : <Text variant="large-title" accessibilityRole="header">Add expense to…</Text>}
        <Text variant="body-small" tone="muted">Pick a group. Your last one is on top.</Text>
      </View>
      <View className="gap-2.5">
        {ordered.map((g) => {
          const used = lastActivity(g);
          const names = g.summary.memberNames.join(', ');
          return (
            <Pressable key={g.group.id} accessibilityRole="button" accessibilityLabel={`${g.group.name}, ${names}`} onPress={() => onPick(g.group.id)} className="active:opacity-80">
              <Card className="min-h-row-tall flex-row items-center gap-3.5 px-4 py-3">
                <AvatarStack className="w-[76px]" members={g.group.members.map((m) => ({ id: m.id, name: m.name }))} />
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text variant="body" className="font-semibold" numberOfLines={1}>{g.group.name}</Text>
                  <Text variant="caption" tone="muted" className="text-[13px]" numberOfLines={1}>{used > 0 ? `${names} · used ${timeAgo(used, now)}` : names}</Text>
                </View>
                <AmountText minorUnits={g.summary.myBalance} currency={g.summary.currencyCode} />
              </Card>
            </Pressable>
          );
        })}
      </View>
      <Button label="Create a new group" variant="secondary" onPress={onCreate} />
    </View>
  );
}
