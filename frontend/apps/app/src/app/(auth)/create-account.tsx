import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { looksLikeEmail, MIN_PASSWORD_LENGTH, passwordProgress } from '@commontab/core';
import { Button, FieldGroup, FieldRow, PasswordMeter, Text } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { AuthLegal } from '@/components/auth/AuthExtras';
import { FailureBanner } from '@/components/auth/FailureBanner';
import { useSubmit } from '@/hooks/useSubmit';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { useIsDesktop } from '@/hooks/useViewport';

export default function CreateAccount() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { register } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, failure, run } = useSubmit('register');
  const progress = passwordProgress(password);
  const ready = name.trim().length > 0 && looksLikeEmail(email) && progress.complete;
  const submit = () => run(() => register(email.trim(), name.trim(), password));

  return (
    <AuthScreen
      heroText="Your groups and expenses are saved to your account, so they follow you to a new phone."
      footer={<Button label={failure?.kind === 'offline' ? 'Try again' : 'Create account'} variant="mint" loading={busy} disabled={!ready} onPress={submit} />}
      below={
        <View className="gap-3">
          <Button label="Already have an account? Sign in" variant="ghost" size="small" onPress={() => router.replace('/sign-in')} />
          <AuthLegal center={!desktop} />
        </View>
      }
    >
      <AuthHeader
        title="Create your account"
        subtitle="Your groups and expenses are saved to your account, so they follow you to a new phone."
      />
      <FailureBanner failure={failure} />
      <FieldGroup>
        <FieldRow label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" autoCapitalize="words" />
        <FieldRow label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoCorrect={false} />
        <FieldRow label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" last />
      </FieldGroup>
      <View className="gap-2">
        <PasswordMeter length={progress.length} required={MIN_PASSWORD_LENGTH} />
        <Text variant="body-small" tone="muted" className="text-[13px] leading-[18px]">A short sentence works well, like three random words.</Text>
      </View>
    </AuthScreen>
  );
}
