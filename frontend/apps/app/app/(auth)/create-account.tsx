import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { looksLikeEmail, MIN_PASSWORD_LENGTH, passwordProgress } from '@commontab/core';
import { Button, FieldGroup, FieldRow, PasswordMeter, Text } from '@commontab/ui';
import { useApp } from '../../src/app-context';
import { FailureBanner } from '../../src/auth/FailureBanner';
import { useSubmit } from '../../src/auth/useSubmit';
import { AuthHeader } from '../../src/components/AuthHeader';
import { AuthScreen } from '../../src/components/AuthScreen';

export default function CreateAccount() {
  const router = useRouter();
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
        <View className="gap-3.5">
          {button}
          <View className="items-center"><Button label="Already have an account? Sign in" variant="ghost" size="small" onPress={() => router.replace('/sign-in')} /></View>
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
      <View className="gap-2 px-2">
        <PasswordMeter length={progress.length} required={MIN_PASSWORD_LENGTH} />
        <Text variant="body-small" tone="muted" className="text-[13px] leading-[18px]">A short sentence works well, like three random words.</Text>
      </View>
    </AuthScreen>
  );
}
