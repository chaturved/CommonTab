import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { looksLikeEmail } from '@commontab/core';
import { Button, FieldGroup, FieldRow } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { FailureBanner } from '@/components/auth/FailureBanner';
import { useSubmit } from '@/hooks/useSubmit';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuthScreen } from '@/components/auth/AuthScreen';

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
    <AuthScreen footer={<Button label={failure?.kind === 'offline' ? 'Try again' : 'Send code'} variant="mint" loading={busy} disabled={!ready} onPress={send} />}>
      <AuthHeader
        title="Reset your password"
        subtitle="Enter the email you signed up with. If there is an account, we will email you a code that works for an hour."
        backTo="/sign-in"
        backOnDesktop
      />
      <FailureBanner failure={failure} />
      <FieldGroup>
        <FieldRow label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoCorrect={false} last onSubmitEditing={() => ready && send()} />
      </FieldGroup>
    </AuthScreen>
  );
}
