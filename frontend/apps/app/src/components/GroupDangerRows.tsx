import { Pressable, View } from 'react-native';
import { Card, Text } from '@commontab/ui';
import type { GroupData } from '../data';

export function GroupActionRows({ data, onLeave, onDelete }: { data: GroupData; onLeave: () => void; onDelete: () => void }) {
  const owner = data.group.ownerID === data.group.meMemberID;
  const row = (label: string, detail: string, onPress: () => void, last?: boolean) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className={`min-h-row flex-row items-center justify-between gap-3 px-4 py-2.5 active:opacity-80 ${last ? '' : 'border-b border-divider'}`}>
      <View className="flex-1">
        <Text variant="body" tone="owe" className="font-semibold">{label}</Text>
        <Text variant="caption" tone="muted" className="text-[13px]">{detail}</Text>
      </View>
    </Pressable>
  );
  return (
    <Card className="overflow-hidden">
      {row('Leave group', 'You keep a read-only copy', onLeave, !owner)}
      {owner ? row('Delete group', 'For everyone, once it is settled', onDelete, true) : null}
    </Card>
  );
}
