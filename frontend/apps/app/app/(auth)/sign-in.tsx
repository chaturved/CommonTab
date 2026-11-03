import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { looksLikeEmail } from '@commontab/core';
import { BackButton, Banner, Button, FieldGroup, FieldRow, Hero, Text } from '@commontab/ui';
import { useApp } from '../../src/app-context';
import { FailureBanner } from '../../src/auth/FailureBanner';
import { useSubmit } from '../../src/auth/useSubmit';
import { Screen } from '../../src/components/Screen';

export default function SignIn() {
  const router = useRouter();
  const params = useLocalSearchParams<{ reset?: string; email?: string }>();
  const reset = params.reset;
  const { signIn } = useApp();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const { busy, failure, run } = useSubmit('signIn');
  const ready = looksLikeEmail(email) && password.length > 0;

  return (
    <Screen
      footer={
        <View className="gap-1">
          <Button
            label={failure?.kind === 'offline' ? 'Try again' : 'Sign in'}
            loading={busy}
            disabled={!ready}
            onPress={() => run(() => signIn(email.trim(), password))}
          />
        </View>
      }
    >
      <View className="flex-row items-center justify-between pt-1">
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      <Hero>
        <Text variant="label" tone="mint">Welcome back</Text>
        <Text variant="large-title" tone="white" accessibilityRole="header" className="text-[26px] leading-[30px]">Pick up where you left off.</Text>
        <Text variant="body-small" tone="hero-muted" className="text-sm leading-5">
          Your groups and expenses will load and stay in sync across your devices.
        </Text>
      </Hero>
      {reset ? <Banner tone="info" message="Your password was changed. Sign in with the new one." /> : null}
      <FailureBanner failure={failure} />
      <FieldGroup>
        <FieldRow label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoCorrect={false} />
        <FieldRow label="Password" value={password} onChangeText={setPassword} placeholder="Required" secureTextEntry autoComplete="current-password" textContentType="password" last onSubmitEditing={() => ready && run(() => signIn(email.trim(), password))} />
      </FieldGroup>
      <View className="items-center">
        <Button label="Forgot password?" variant="ghost" size="small" onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })} />
        <Button label="New here? Create an account" variant="ghost" size="small" onPress={() => router.replace('/create-account')} />
      </View>
      <Text variant="body-small" tone="muted" className="px-7 text-center text-[13px] leading-[18px]">
        Signing in needs an internet connection the first time. After that the app works offline.
      </Text>
    </Screen>
  );
}
