import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cx } from '@commontab/ui';

export function Screen({ children, footer, className }: { children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="w-full max-w-[480px] flex-1 self-center">
          <ScrollView className="flex-1" contentContainerClassName={cx('gap-4 px-4 pb-6 pt-4', className)} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View className="px-4 pb-4 pt-2">{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
