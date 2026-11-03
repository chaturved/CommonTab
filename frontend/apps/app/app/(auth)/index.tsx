import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button, Text } from '@commontab/ui';
import { useApp } from '../../src/app-context';

export default function SignIn() {
  const { signIn, register } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const run = (work: () => Promise<void>) => work().catch((e: Error) => setMessage(e.message));
  return (
    <View className="flex-1 justify-center gap-3 bg-background p-4">
      <Text variant="screen-title">CommonTab</Text>
      <TextInput accessibilityLabel="Email" autoCapitalize="none" value={email} onChangeText={setEmail} className="min-h-touch rounded-md border border-line px-3 text-fg" />
      <TextInput accessibilityLabel="Password" secureTextEntry value={password} onChangeText={setPassword} className="min-h-touch rounded-md border border-line px-3 text-fg" />
      <Button label="Sign in" onPress={() => run(() => signIn(email, password))} />
      <Button label="Create account" variant="secondary" onPress={() => run(() => register(email, email.split('@')[0] ?? 'Me', password))} />
      {message ? <Text tone="owe">{message}</Text> : null}
    </View>
  );
}
