import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { MIN_PASSWORD_LENGTH, passwordProgress } from '@commontab/core';
import { BackButton, Banner, Button, FieldGroup, FieldRow, PasswordMeter, Text } from '@commontab/ui';
import { useApp } from '../../src/app-context';
import { FailureBanner } from '../../src/auth/FailureBanner';
import { useSubmit } from '../../src/auth/useSubmit';
import { Screen } from '../../src/components/Screen';

export default function ResetPassword() {
  const router = useRouter();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const { services } = useApp();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [resent, setResent] = useState(false);
  const confirm = useSubmit('resetConfirm');
  const resend = useSubmit('resetRequest');
  const progress = passwordProgress(password);
  const ready = code.trim().length > 0 && progress.complete;
  const failure = confirm.failure ?? resend.failure;

  const save = async () => {
    const done = await confirm.run(() => services.api.confirmPasswordReset({ email, code: code.trim(), newPassword: password }));
    if (done) router.replace({ pathname: '/sign-in', params: { reset: '1', email } });
  };
  const sendAgain = async () => {
    setResent(false);
    if (await resend.run(() => services.api.requestPasswordReset(email))) setResent(true);
  };

  return (
    <Screen footer={<Button label="Set new password" loading={confirm.busy} disabled={!ready} onPress={save} />}>
      <View className="flex-row items-center justify-between pt-1">
        <BackButton />
      </View>
      <View className="gap-1.5 px-2 pt-2">
        <Text variant="large-title" accessibilityRole="header">Enter your code</Text>
        <Text variant="body-small" tone="muted" className="leading-[21px]">
          If {email} has an account, we emailed it a code like ABCD-2345. It works for an hour.
        </Text>
      </View>
      <FailureBanner failure={failure} />
      {resent && !failure ? <Banner tone="info" message="We sent a new code. The old one no longer works." /> : null}
      <FieldGroup>
        <FieldRow label="Code" value={code} onChangeText={setCode} placeholder="ABCD-2345" autoCapitalize="characters" autoCorrect={false} autoComplete="one-time-code" textContentType="oneTimeCode" />
        <FieldRow label="Password" value={password} onChangeText={setPassword} placeholder="New password" secureTextEntry autoComplete="new-password" textContentType="newPassword" last />
      </FieldGroup>
      <View className="gap-2 px-2">
        <PasswordMeter length={progress.length} required={MIN_PASSWORD_LENGTH} />
      </View>
      <View className="items-center">
        <Button label="Send a new code" variant="ghost" size="small" loading={resend.busy} onPress={sendAgain} />
      </View>
    </Screen>
  );
}
