import { View } from 'react-native';
import { Button, Text } from '@commontab/ui';

interface Props {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export function ErrorScreen({ title, message, actionLabel, onAction }: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-site-bg px-6">
      <Text variant="large-title" tone="site-text" accessibilityRole="header" className="text-center">{title}</Text>
      <Text tone="site-muted" className="max-w-[360px] text-center">{message}</Text>
      <View className="mt-3 w-full max-w-[280px]">
        <Button label={actionLabel} onPress={onAction} />
      </View>
    </View>
  );
}
