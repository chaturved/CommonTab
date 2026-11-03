import { View } from 'react-native';
import { Text } from '@commontab/ui';
import { Screen } from '../../../src/components/Screen';

export default function Activity() {
  return (
    <Screen wide tabs>
      <View className="min-h-touch justify-center px-1">
        <Text variant="large-title" accessibilityRole="header">Activity</Text>
      </View>
      <View className="items-center gap-2 px-6 py-10">
        <Text variant="section" className="text-center">Nothing here yet</Text>
        <Text tone="muted" className="text-center">Changes from people in your groups will show up here.</Text>
      </View>
    </Screen>
  );
}
