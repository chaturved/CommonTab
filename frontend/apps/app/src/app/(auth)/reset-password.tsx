import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { MIN_PASSWORD_LENGTH, passwordProgress } from '@commontab/core';
import { Banner, Button, FieldGroup, FieldRow, PasswordMeter } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { FailureBanner } from '@/components/auth/FailureBanner';
import { useSubmit } from '@/hooks/useSubmit';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuthScreen } from '@/components/auth/AuthScreen';

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
    <AuthScreen footer={<Button label="Set new password" variant="mint" loading={confirm.busy} disabled={!ready} onPress={save} />}>
      <AuthHeader
        title="Enter your code"
        subtitle={`If ${email} has an account, we emailed it a code like ABCD-2345. It works for an hour.`}
        backTo="/sign-in"
        backOnDesktop
      />
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
    </AuthScreen>
  );
}
