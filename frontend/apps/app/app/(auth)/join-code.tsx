import { useState } from 'react';
import { useRouter } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { View } from 'react-native';
import { BackButton, Button, FieldGroup, FieldLayoutProvider, FieldRow, Icon, Text } from '@commontab/ui';
import { useApp } from '../../src/app-context';
import { AuthScreen } from '../../src/components/AuthScreen';

export default function JoinWithCode() {
  const router = useRouter();
  const { setPendingJoinCode } = useApp();
  const [code, setCode] = useState('');
  const ready = code.trim().length > 0;
  const go = (to: '/create-account' | '/sign-in') => {
    setPendingJoinCode(code.trim());
    router.push(to);
  };

  return (
    <AuthScreen
      footer={
        <View className="gap-2.5">
          <Button label="Create account" disabled={!ready} onPress={() => go('/create-account')} />
          <Button label="I already have an account" variant="secondary" disabled={!ready} onPress={() => go('/sign-in')} />
        </View>
      }
    >
      <View className="flex-row items-center pt-1"><BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /></View>
      <View className="items-center gap-2 px-4">
        <View className="h-16 w-16 items-center justify-center rounded-pill bg-tint">
          <Icon icon={UserPlus} size={34} strokeWidth={1.8} tone="accent" />
        </View>
        <Text variant="section" accessibilityRole="header">Got an invitation?</Text>
        <Text tone="muted" className="text-center leading-[22px]">Enter the code a friend sent you. You'll make an account first, then join automatically.</Text>
      </View>
      <FieldLayoutProvider layout="stacked">
        <FieldGroup>
          <FieldRow label="Invitation code" value={code} onChangeText={setCode} placeholder="Paste code" autoCapitalize="characters" autoCorrect={false} />
        </FieldGroup>
      </FieldLayoutProvider>
    </AuthScreen>
  );
}
