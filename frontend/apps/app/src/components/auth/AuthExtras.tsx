import { View } from 'react-native';
import { Text } from '@commontab/ui';

export function AuthDivider() {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-divider" />
      <Text variant="caption" tone="muted" className="text-[13px]">or</Text>
      <View className="h-px flex-1 bg-divider" />
    </View>
  );
}

export function AuthLegal({ center }: { center?: boolean }) {
  return (
    <Text variant="caption" tone="muted" className={`text-[13px] leading-5 ${center ? 'text-center' : ''}`}>
      By continuing, you agree to the <Text variant="caption" tone="fg" className="text-[13px] font-semibold underline">Terms</Text> and <Text variant="caption" tone="fg" className="text-[13px] font-semibold underline">Privacy Policy</Text>.
    </Text>
  );
}
