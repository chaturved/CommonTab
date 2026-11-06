import { View } from 'react-native';
import { Button, Sheet, Text } from '@commontab/ui';

interface Props {
  visible: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}

export function DiscardSheet({ visible, onKeep, onDiscard }: Props) {
  return (
    <Sheet visible={visible} onClose={onKeep} title="Discard changes?">
      <Text variant="body-small" tone="fg-soft" className="leading-[22px]">What you entered on this expense won't be saved.</Text>
      <View className="gap-2.5">
        <Button label="Keep editing" onPress={onKeep} />
        <Button label="Discard" variant="secondary" onPress={onDiscard} />
      </View>
    </Sheet>
  );
}

export function DiscardBar({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return (
    <View className="w-full flex-row items-center justify-between gap-4">
      <Text variant="body-small" tone="fg-soft" accessibilityRole="alert" className="min-w-0 flex-1">Discard this expense? What you entered won't be saved.</Text>
      <View className="flex-row gap-2.5">
        <Button label="Discard" variant="secondary" size="small" onPress={onDiscard} />
        <Button label="Keep editing" size="small" onPress={onKeep} />
      </View>
    </View>
  );
}
