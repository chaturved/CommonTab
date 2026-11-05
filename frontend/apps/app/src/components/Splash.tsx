import { ActivityIndicator, View } from 'react-native';
import { colors } from '@commontab/ui';

export function Splash() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" className="flex-1 items-center justify-center bg-site-bg">
      <ActivityIndicator size="large" color={colors.light.mint} />
    </View>
  );
}
