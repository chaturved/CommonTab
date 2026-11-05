import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cx } from '@commontab/ui';
import { useIsDesktop } from '@/hooks/useViewport';

export interface ScreenProps {
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  tabs?: boolean;
  className?: string;
}

export function Screen({ children, footer, wide, tabs, className }: ScreenProps) {
  const desktop = useIsDesktop();
  if (desktop && wide) {
    return (
      <View className="flex-1 bg-background">
        <ScrollView className="flex-1" contentContainerClassName={cx('w-full max-w-[1120px] gap-[22px] self-center px-10 py-7', className)} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View className="px-10 pb-6 pt-2">{footer}</View> : null}
      </View>
    );
  }
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className={cx('w-full flex-1 self-center', wide ? 'max-w-[720px]' : 'max-w-[480px]')}>
          <ScrollView className="flex-1" contentContainerClassName={cx('gap-4 px-4 pt-4', tabs ? 'pb-32' : 'pb-6', className)} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View className="px-4 pb-4 pt-2">{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
