import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, FieldGroup, FieldRow } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { AuthDivider } from '@/components/auth/AuthExtras';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuthScreen } from '@/components/auth/AuthScreen';

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
      heroText="Join a group with the code a friend sent you. Everyone sees the same balances."
      footer={<Button label="Create account" variant="mint" disabled={!ready} onPress={() => go('/create-account')} />}
      below={
        <View className="gap-3">
          <AuthDivider />
          <Button label="I already have an account" variant="deep" disabled={!ready} onPress={() => go('/sign-in')} />
        </View>
      }
    >
      <AuthHeader
        title="Got an invitation?"
        subtitle="Enter the code a friend sent you. You'll make an account first, then join automatically."
      />
      <FieldGroup>
        <FieldRow label="Invite code" value={code} onChangeText={setCode} placeholder="Paste code" autoCapitalize="characters" autoCorrect={false} />
      </FieldGroup>
    </AuthScreen>
  );
}
