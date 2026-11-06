import { useRouter, type Href } from 'expo-router';
import { Platform, View } from 'react-native';
import { BackButton, Text } from '@commontab/ui';
import { useIsDesktop } from '@/hooks/useViewport';
import { AuthBrand } from '@/components/auth/AuthBrand';

interface AuthHeaderProps {
  title: string;
  subtitle: string;
  backTo?: Href;
  backOnDesktop?: boolean;
}

export function AuthHeader({ title, subtitle, backTo = Platform.OS === 'web' ? '/' : '/welcome', backOnDesktop }: AuthHeaderProps) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const back = () => (router.canGoBack() ? router.back() : router.replace(backTo));
  return (
    <>
      {desktop ? (
        backOnDesktop ? <View className="flex-row"><BackButton onPress={back} /></View> : null
      ) : (
        <View className="flex-row items-center justify-between">
          <BackButton onPress={back} />
          <AuthBrand />
        </View>
      )}
      <View className="gap-3">
        <Text accessibilityRole="header" className={`font-light leading-[1.02] tracking-[-0.045em] ${desktop ? '!text-[44px]' : '!text-4xl'}`}>{title}</Text>
        <Text tone="muted" className="text-base leading-6">{subtitle}</Text>
      </View>
    </>
  );
}
