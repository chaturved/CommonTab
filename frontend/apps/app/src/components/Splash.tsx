import { View } from 'react-native';
import { Text } from '@commontab/ui';

export function Splash() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading CommonTab" className="flex-1 items-center justify-center bg-site-bg">
      <Text tone="site-text" className="text-2xl font-semibold">CommonTab</Text>
    </View>
  );
}
