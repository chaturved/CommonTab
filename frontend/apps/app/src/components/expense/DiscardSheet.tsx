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
