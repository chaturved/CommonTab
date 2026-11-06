import { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FieldLayoutProvider, Text, ThemeScope, colors } from '@commontab/ui';
import { useIsDesktop } from '@/hooks/useViewport';
import { AuthBrand } from '@/components/auth/AuthBrand';
import { AuthPeek } from '@/components/auth/AuthPeek';

const DEFAULT_HERO = 'Sign in to see your groups on any device. Changes made offline sync when you reconnect.';
const DARK = colors.dark;
const HERO_BACKGROUND = { backgroundImage: `linear-gradient(160deg, ${DARK['hero-from']}, ${DARK['hero-to']})` };

interface Props {
  children: ReactNode;
  footer?: ReactNode;
  below?: ReactNode;
  heroText?: string;
}

function Layout({ children, footer, below, heroText = DEFAULT_HERO }: Props) {
  const desktop = useIsDesktop();
  const router = useRouter();

  if (!desktop) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="w-full max-w-[480px] flex-1 self-center">
            <ScrollView className="flex-1" contentContainerClassName="gap-5 px-5 pb-6 pt-4" keyboardShouldPersistTaps="handled">
              {children}
              {below}
            </ScrollView>
            {footer ? <View className="border-t border-divider px-5 pb-5 pt-4">{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const brand = <AuthBrand boxed />;
  return (
    <View className="flex-1 flex-row bg-background">
      <View className="w-1/2 justify-between overflow-hidden p-14" style={HERO_BACKGROUND as never}>
        {Platform.OS === 'web' ? (
          <Pressable accessibilityRole="link" accessibilityLabel="CommonTab home" onPress={() => router.push('/')} className="self-start active:opacity-80">{brand}</Pressable>
        ) : brand}
        <View>
          <Text accessibilityRole="header" aria-level={1} tone="white" className="max-w-[520px] font-light leading-[0.95] tracking-[-0.045em]" style={{ fontSize: 'clamp(46px, 4.6vw, 68px)' } as never}>Nobody should do bill math twice.</Text>
          <Text tone="hero-muted" className="mt-5 max-w-[440px] !text-[19px] leading-7">{heroText}</Text>
        </View>
        <Text variant="caption" tone="hero-muted" className="text-[13px]">Privacy · Terms</Text>
        <AuthPeek />
      </View>
      <ScrollView className="flex-1" contentContainerClassName="min-h-full items-center justify-center px-6 py-10" keyboardShouldPersistTaps="handled">
        <View className="w-full max-w-[420px] gap-5">
          {children}
          {footer}
          {below}
        </View>
      </ScrollView>
    </View>
  );
}

export function AuthScreen(props: Props) {
  return (
    <ThemeScope scheme="dark">
      <FieldLayoutProvider layout="pill">
        <Layout {...props} />
      </FieldLayoutProvider>
    </ThemeScope>
  );
}
