import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { looksLikeEmail } from '@commontab/core';
import { BackButton, Button, FieldGroup, FieldRow, Text } from '@commontab/ui';
import { useApp } from '../../src/app-context';
import { FailureBanner } from '../../src/auth/FailureBanner';
import { useSubmit } from '../../src/auth/useSubmit';
import { AuthScreen } from '../../src/components/AuthScreen';

export default function ForgotPassword() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { services } = useApp();
  const [email, setEmail] = useState(params.email ?? '');
  const { busy, failure, run } = useSubmit('resetRequest');
  const ready = looksLikeEmail(email);
  const send = async () => {
    const address = email.trim();
    if (await run(() => services.api.requestPasswordReset(address))) {
      router.push({ pathname: '/reset-password', params: { email: address } });
    }
  };

  return (
    <AuthScreen footer={<Button label={failure?.kind === 'offline' ? 'Try again' : 'Send code'} loading={busy} disabled={!ready} onPress={send} />}>
      <View className="flex-row items-center justify-between pt-1">
        <BackButton />
      </View>
      <View className="gap-1.5 px-2 pt-2">
        <Text variant="large-title" accessibilityRole="header">Reset your password</Text>
        <Text variant="body-small" tone="muted" className="leading-[21px]">
          Enter the email you signed up with. If there is an account, we will email you a code that works for an hour.
        </Text>
      </View>
      <FailureBanner failure={failure} />
      <FieldGroup>
        <FieldRow label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoCorrect={false} last onSubmitEditing={() => ready && send()} />
      </FieldGroup>
    </AuthScreen>
  );
}
