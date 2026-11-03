import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { looksLikeEmail, MIN_PASSWORD_LENGTH, passwordProgress } from '@commontab/core';
import { BackButton, Button, FieldGroup, FieldRow, PasswordMeter, Text } from '@commontab/ui';
import { useApp } from '../../src/app-context';
import { FailureBanner } from '../../src/auth/FailureBanner';
import { useSubmit } from '../../src/auth/useSubmit';
import { AuthScreen } from '../../src/components/AuthScreen';
import { useIsDesktop } from '../../src/layout';

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
  const button = <Button label={failure?.kind === 'offline' ? 'Try again' : 'Create account'} loading={busy} disabled={!ready} onPress={submit} />;

  return (
    <AuthScreen
      footer={
        desktop ? (
          <View className="gap-3.5">
            {button}
            <View className="items-center"><Button label="Already have an account? Sign in" variant="ghost" size="small" onPress={() => router.replace('/sign-in')} /></View>
          </View>
        ) : button
      }
    >
      {desktop ? null : (
        <View className="flex-row items-center justify-between pt-1">
          <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
        </View>
      )}
      <View className={desktop ? 'gap-1.5' : 'gap-1.5 px-2 pt-2'}>
        <Text variant="large-title" accessibilityRole="header">Create your account</Text>
        <Text variant="body-small" tone="muted" className={desktop ? 'text-[15px]' : 'leading-[21px]'}>
          {desktop ? 'Free. Works offline.' : 'Your groups and expenses are saved to your account, so they follow you to a new phone.'}
        </Text>
      </View>
      <FailureBanner failure={failure} />
      <FieldGroup>
        <FieldRow label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" autoCapitalize="words" />
        <FieldRow label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoCorrect={false} />
        <FieldRow label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" last />
      </FieldGroup>
      <View className="gap-2 px-2">
        <PasswordMeter length={progress.length} required={MIN_PASSWORD_LENGTH} />
        <Text variant="body-small" tone="muted" className="text-[13px] leading-[18px]">A short sentence works well, like three random words.</Text>
      </View>
    </AuthScreen>
  );
}
