import { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { FieldLayoutProvider, Text, colors } from '@commontab/ui';
import { useIsDesktop } from '@/hooks/useViewport';
import { Wordmark } from '@/components/ui/Logo';
import { Screen } from '@/components/layout/Screen';

export function AuthScreen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const desktop = useIsDesktop();
  const router = useRouter();
  if (!desktop) return <Screen footer={footer}>{children}</Screen>;
  return (
    <View className="flex-1 flex-row bg-background">
      <LinearGradient colors={[colors.light['hero-from'], '#061A20']} start={{ x: 0.2, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ width: '50%', padding: 56, justifyContent: 'space-between' }}>
        {Platform.OS === 'web' ? (
          <Pressable accessibilityRole="link" accessibilityLabel="CommonTab home" onPress={() => router.push('/')} className="self-start active:opacity-80">
            <Wordmark size={24} light />
          </Pressable>
        ) : (
          <Wordmark size={24} light />
        )}
        <View>
          <Text variant="large-title" tone="white" accessibilityRole="header" style={{ fontSize: 52, lineHeight: 54, fontWeight: '600', letterSpacing: -2.3 }}>
            Nobody should do bill math twice.
          </Text>
          <Text tone="hero-muted" className="mt-4 max-w-[420px] text-[17px] leading-[26px]">
            Sign in to see your groups on any device. Changes made offline sync when you reconnect.
          </Text>
        </View>
        <Text variant="caption" tone="hero-muted" className="text-[13px]">Privacy · Terms</Text>
      </LinearGradient>
      <ScrollView className="flex-1" contentContainerClassName="min-h-full items-center justify-center px-6 py-10">
        <FieldLayoutProvider layout="stacked">
          <View className="w-full max-w-[380px] gap-[18px]">
            {children}
            {footer}
          </View>
        </FieldLayoutProvider>
      </ScrollView>
    </View>
  );
}
