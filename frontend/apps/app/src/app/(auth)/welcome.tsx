import { Redirect, useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, ThemeScope, colors } from '@commontab/ui';
import { BrandMark } from '@/components/ui/BrandMark';
import { AuthLegal } from '@/components/auth/AuthExtras';
import { useIsDesktop } from '@/hooks/useViewport';

const DARK = colors.dark;
const BACKGROUND = { backgroundImage: `linear-gradient(160deg, ${DARK['hero-from']}, ${DARK['hero-to']})` };

export default function Welcome() {
  const router = useRouter();
  const desktop = useIsDesktop();
  if (desktop) return <Redirect href="/sign-in" />;
  return (
    <ThemeScope scheme="dark" style={BACKGROUND as never}>
      <SafeAreaView className="flex-1">
        <View className="w-full max-w-[480px] flex-1 self-center px-6 pb-7">
          <View className="flex-1 items-center justify-center gap-[18px]">
            <View aria-hidden className="h-[88px] w-[88px] items-center justify-center rounded-[26px] border border-site-line bg-hero-to">
              <BrandMark size={60} />
            </View>
            <Text accessibilityRole="header" aria-label="CommonTab" tone="white" className="!text-[38px] tracking-[-1.52px]">
              <Text tone="white" className="!text-[38px] font-bold">Common</Text>
              <Text tone="white" className="!text-[38px] font-normal">Tab</Text>
            </Text>
            <Text tone="hero-muted" className="max-w-[280px] text-center !text-[19px] font-light leading-[26px]">Nobody should do bill math twice.</Text>
          </View>
          <View className="gap-3">
            <Button label="Create account" variant="mint" onPress={() => router.push('/create-account')} />
            <Button label="Sign in" variant="deep" onPress={() => router.push('/sign-in')} />
            <Button label="Have an invite code? Join a group" variant="ghost" size="small" onPress={() => router.push('/join-code')} />
            <AuthLegal center />
          </View>
        </View>
      </SafeAreaView>
    </ThemeScope>
  );
}
