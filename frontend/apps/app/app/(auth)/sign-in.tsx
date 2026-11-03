import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { looksLikeEmail } from '@commontab/core';
import { BackButton, Banner, Button, FieldGroup, FieldRow, Hero, Text } from '@commontab/ui';
import { useApp } from '../../src/app-context';
import { FailureBanner } from '../../src/auth/FailureBanner';
import { useSubmit } from '../../src/auth/useSubmit';
import { AuthScreen } from '../../src/components/AuthScreen';
import { useIsDesktop } from '../../src/layout';

export default function SignIn() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const params = useLocalSearchParams<{ reset?: string; email?: string }>();
  const reset = params.reset;
  const { signIn } = useApp();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const { busy, failure, run } = useSubmit('signIn');
  const ready = looksLikeEmail(email) && password.length > 0;

  const submit = () => run(() => signIn(email.trim(), password));
  const button = <Button label={failure?.kind === 'offline' ? 'Try again' : 'Sign in'} loading={busy} disabled={!ready} onPress={submit} />;
  const createLink = <Button label="New here? Create an account" variant="ghost" size="small" onPress={() => router.replace('/create-account')} />;
  const forgot = <Button label="Forgot password?" variant="ghost" size="small" onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })} />;

  return (
    <AuthScreen
      footer={desktop ? <View className="gap-3.5">{button}<View className="items-center">{createLink}</View><View className="items-center border-t border-field-border pt-4"><Button label="Have an invite code? Join a group" variant="ghost" size="small" onPress={() => router.push('/join-code')} /></View></View> : button}
    >
      {desktop ? (
        <View className="gap-1.5">
          <Text variant="large-title" accessibilityRole="header">Welcome back</Text>
          <Text variant="body-small" tone="muted" className="text-[15px]">Sign in to CommonTab</Text>
        </View>
      ) : (
        <View className="flex-row items-center justify-between pt-1">
          <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>
      )}
      {desktop ? null : <Hero>
        <Text variant="label" tone="mint">Welcome back</Text>
        <Text variant="large-title" tone="white" accessibilityRole="header" className="text-[26px] leading-[30px]">Pick up where you left off.</Text>
        <Text variant="body-small" tone="hero-muted" className="text-sm leading-5">
          Your groups and expenses will load and stay in sync across your devices.
        </Text>
      </Hero>}
      {reset ? <Banner tone="info" message="Your password was changed. Sign in with the new one." /> : null}
      <FailureBanner failure={failure} />
      <FieldGroup>
        <FieldRow label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoCorrect={false} />
        <FieldRow label="Password" value={password} onChangeText={setPassword} placeholder="Required" secureTextEntry autoComplete="current-password" textContentType="password" last onSubmitEditing={() => ready && submit()} />
      </FieldGroup>
      {desktop ? (
        <View className="items-end">{forgot}</View>
      ) : (
        <>
          <View className="items-center">
            {forgot}
            {createLink}
          </View>
          <Text variant="body-small" tone="muted" className="px-7 text-center text-[13px] leading-[18px]">
            Signing in needs an internet connection the first time. After that the app works offline.
          </Text>
        </>
      )}
    </AuthScreen>
  );
}
