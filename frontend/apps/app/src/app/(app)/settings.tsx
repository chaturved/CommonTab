import { Redirect, useRouter } from 'expo-router';
import { View } from 'react-native';
import { BackButton, Text } from '@commontab/ui';
import { Screen } from '@/components/layout/Screen';
import { SettingsPanel } from '@/components/account/SettingsPanel';
import { useIsDesktop } from '@/hooks/useViewport';

export default function Settings() {
  const router = useRouter();
  const desktop = useIsDesktop();
  if (desktop) return <Redirect href="/account" />;
  return (
    <Screen wide>
      <View className="min-h-touch w-full max-w-[560px] flex-row items-center justify-between self-center">
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/account'))} />
        <Text variant="screen-title" accessibilityRole="header">Settings</Text>
        <View className="w-11" />
      </View>
      <View className="w-full max-w-[560px] self-center">
        <SettingsPanel showVersion />
      </View>
    </Screen>
  );
}
