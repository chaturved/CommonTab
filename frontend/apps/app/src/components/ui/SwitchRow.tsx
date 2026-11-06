import { Pressable, View } from 'react-native';
import { Text } from '@commontab/ui';

export function SwitchRow({ title, detail, value, onChange }: { title: string; detail: string; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <View className="min-h-row flex-row items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3.5">
      <View className="flex-1">
        <Text variant="body" className="font-bold">{title}</Text>
        <Text variant="caption" tone="muted" className="text-[13px]">{detail}</Text>
      </View>
      <Pressable accessibilityRole="switch" accessibilityLabel={title} accessibilityState={{ checked: value }} onPress={() => onChange(!value)} hitSlop={6} className={`h-8 w-[52px] justify-center rounded-pill px-0.5 ${value ? 'bg-accent' : 'bg-field-border'}`}>
        <View className={`h-7 w-7 rounded-pill bg-white ${value ? 'self-end' : 'self-start'}`} />
      </Pressable>
    </View>
  );
}
