import { View } from 'react-native';
import { Text } from '@commontab/ui';
import { PageHeader } from '../../../src/components/PageHeader';
import { Screen } from '../../../src/components/Screen';
import { useIsDesktop } from '../../../src/layout';

export default function Activity() {
  const desktop = useIsDesktop();
  return (
    <Screen wide tabs>
      {desktop ? (
        <PageHeader title="Activity" subtitle="Everything across your groups" />
      ) : (
        <View className="min-h-touch justify-center px-1">
          <Text variant="large-title" accessibilityRole="header">Activity</Text>
        </View>
      )}
      <View className="items-center gap-2 px-6 py-10">
        <Text variant="section" className="text-center">Nothing here yet</Text>
        <Text tone="muted" className="text-center">Changes from people in your groups will show up here.</Text>
      </View>
    </Screen>
  );
}
