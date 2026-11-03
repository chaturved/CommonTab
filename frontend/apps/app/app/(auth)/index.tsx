import { Redirect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { ClipPath, Circle, Defs } from 'react-native-svg';
import { Button, Text, colors } from '@commontab/ui';
import { useIsDesktop } from '../../src/layout';

function Logo() {
  return (
    <View className="h-[88px] w-[88px] items-center justify-center rounded-[26px] border bg-hero-from" style={{ borderColor: 'rgba(143,229,199,0.25)' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={60} height={60} viewBox="0 0 96 96">
        <Defs>
          <ClipPath id="overlap"><Circle cx={36} cy={48} r={28} /></ClipPath>
        </Defs>
        <Circle cx={36} cy={48} r={28} fill="#2D8F86" />
        <Circle cx={60} cy={48} r={28} fill="#5FD3B3" />
        <Circle cx={60} cy={48} r={28} fill="#E8FFF6" clipPath="url(#overlap)" />
      </Svg>
    </View>
  );
}

export default function Welcome() {
  const router = useRouter();
  const desktop = useIsDesktop();
  if (desktop) return <Redirect href="/sign-in" />;
  return (
    <LinearGradient colors={[colors.light['hero-from'], colors.light['hero-to']]} start={{ x: 0.1, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView className="flex-1">
        <View className="w-full max-w-[480px] flex-1 self-center px-6 pb-10">
          <View className="flex-1 items-center justify-center gap-[18px]">
            <Logo />
            <Text variant="large-title" tone="white" accessibilityRole="header" className="text-[38px] leading-[44px]">
              <Text variant="large-title" tone="white" className="text-[38px] font-bold">Common</Text>
              <Text variant="large-title" tone="white" className="text-[38px] font-normal">Tab</Text>
            </Text>
            <Text tone="hero-muted" className="max-w-[280px] text-center text-[17px] leading-6">
              Split costs with friends and keep every balance in one place.
            </Text>
          </View>
          <View className="gap-3">
            <Button label="Create account" variant="hero" onPress={() => router.push('/create-account')} />
            <Button label="Sign in" variant="hero-outline" onPress={() => router.push('/sign-in')} />
            <Text variant="caption" tone="hero-muted" className="pt-1 text-center text-xs leading-[18px]">
              By continuing you agree to the Terms and Privacy Policy.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
