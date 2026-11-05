import { useRouter, type Href } from 'expo-router';
import { Platform, View } from 'react-native';
import { BackButton, Text } from '@commontab/ui';
import { useIsDesktop } from '../layout';
import { Wordmark } from './Logo';

interface AuthHeaderProps {
  title: string;
  subtitle: string;
  desktopTitle?: string;
  desktopSubtitle?: string;
  backTo?: Href;
  backOnDesktop?: boolean;
}

export function AuthHeader({ title, subtitle, desktopTitle, desktopSubtitle, backTo = Platform.OS === 'web' ? '/' : '/welcome', backOnDesktop }: AuthHeaderProps) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const back = () => (router.canGoBack() ? router.back() : router.replace(backTo));
  return (
    <>
      {desktop ? (
        backOnDesktop ? <View className="flex-row"><BackButton onPress={back} /></View> : null
      ) : (
        <View className="flex-row items-center justify-between pt-1">
          <BackButton onPress={back} />
          <Wordmark size={20} />
        </View>
      )}
      <View className={desktop ? 'gap-1.5' : 'gap-1.5 px-2 pt-2'}>
        <Text variant="large-title" accessibilityRole="header">{desktop ? desktopTitle ?? title : title}</Text>
        <Text variant="body-small" tone="muted" className={desktop ? 'text-[15px]' : 'leading-[21px]'}>{desktop ? desktopSubtitle ?? subtitle : subtitle}</Text>
      </View>
    </>
  );
}
