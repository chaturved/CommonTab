import { useState } from 'react';
import { useRouter } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { View } from 'react-native';
import { ApiError } from '@commontab/core';
import { Banner, Button, FieldGroup, FieldLayoutProvider, FieldRow, Icon, Text } from '@commontab/ui';
import { useApp } from '../../src/app-context';
import { Screen } from '../../src/components/Screen';

export default function JoinGroup() {
  const router = useRouter();
  const { services } = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const snapshot = await services.api.joinWithCode(code.trim());
      await services.engine.sync();
      router.replace({ pathname: '/group/[id]', params: { id: snapshot.id } });
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.isNetwork) setProblem('Joining needs an internet connection. Try again when you are back online.');
      else if (error instanceof ApiError && error.status === 404) setProblem("That code isn't valid or has expired. Check it with the person who sent it.");
      else if (error instanceof ApiError && error.status === 429) setProblem('Too many tries. Wait a minute and try again.');
      else if (error instanceof ApiError && error.status === 409) setProblem('That invitation was already used for this person.');
      else setProblem("Couldn't join right now. Try again in a moment.");
    }
  };

  return (
    <Screen wide footer={<View className="w-full max-w-[560px] self-center"><Button label="Join group" loading={busy} disabled={code.trim().length === 0} onPress={join} /></View>}>
      <View className="min-h-touch w-full max-w-[560px] flex-row items-center justify-between self-center">
        <Button label="Cancel" variant="ghost" size="small" onPress={() => router.back()} />
        <Text variant="screen-title" accessibilityRole="header">Join group</Text>
        <View className="w-[72px]" />
      </View>
      <View className="w-full max-w-[560px] gap-4 self-center">
        <View className="items-center gap-2 px-4 py-4">
          <View className="h-16 w-16 items-center justify-center rounded-pill bg-tint">
            <Icon icon={UserPlus} size={34} strokeWidth={1.8} tone="accent" />
          </View>
          <Text variant="section" accessibilityRole="header">Got an invitation?</Text>
          <Text tone="muted" className="text-center leading-[22px]">Enter the code a friend sent you. You will be added right away and can see the group on all your devices.</Text>
        </View>
        {problem ? <Banner tone="error" message={problem} /> : null}
        <FieldLayoutProvider layout="stacked">
          <FieldGroup>
            <FieldRow label="Invitation code" value={code} onChangeText={setCode} placeholder="Paste code" autoCapitalize="characters" autoCorrect={false} autoFocus onSubmitEditing={() => code.trim() && void join()} />
          </FieldGroup>
        </FieldLayoutProvider>
      </View>
    </Screen>
  );
}
