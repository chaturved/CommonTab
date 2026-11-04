import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, FieldGroup, FieldRow, Sheet, Text } from '@commontab/ui';
import { useApp } from '../app-context';
import { useSyncStatus } from '../useSyncStatus';
import { FailureBanner } from './FailureBanner';
import { useSubmit } from './useSubmit';

export function SessionExpiredSheet() {
  const { user, signIn, services } = useApp();
  const expired = useSyncStatus()?.connectivity === 'sessionExpired';
  const [dismissed, setDismissed] = useState(false);
  const [password, setPassword] = useState('');
  const { busy, failure, run, clear } = useSubmit('signIn');

  useEffect(() => {
    if (!expired) {
      setDismissed(false);
      setPassword('');
      clear();
    }
  }, [expired]);

  const submit = async () => {
    if (await run(() => signIn(user!.email, password))) void services.engine.sync();
  };

  return (
    <Sheet visible={expired && !dismissed && user !== null} onClose={() => setDismissed(true)} title="Sign in again">
      <Text variant="body-small" tone="fg-soft" className="leading-[22px]">
        Your session ended, so changes can't sync right now. Everything you added is safe on this phone and will sync after you sign in.
      </Text>
      <FailureBanner failure={failure} />
      <View className="overflow-hidden rounded-2xl bg-background">
        <FieldGroup className="bg-background">
          <View className="min-h-row flex-row items-center gap-3 border-b border-divider px-4">
            <Text variant="body-small" tone="muted" className="w-[84px]">Email</Text>
            <Text className="flex-1 font-semibold" accessibilityLabel={`Signed in as ${user?.email}`}>{user?.email}</Text>
          </View>
          <FieldRow label="Password" value={password} onChangeText={setPassword} placeholder="Required" secureTextEntry autoComplete="current-password" textContentType="password" last onSubmitEditing={() => password && submit()} />
        </FieldGroup>
      </View>
      <Button label={failure?.kind === 'offline' ? 'Try again' : 'Sign in'} loading={busy} disabled={password.length === 0} onPress={submit} />
      <Button label="Not now" variant="ghost" onPress={() => setDismissed(true)} />
    </Sheet>
  );
}
