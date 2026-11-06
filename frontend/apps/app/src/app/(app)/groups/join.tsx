import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { View } from 'react-native';
import { ApiError } from '@commontab/core';
import { Banner, FieldGroup, FieldLayoutProvider, FieldRow, Icon, Text } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { CodeBoxes } from '@/components/ui/CodeBoxes';
import { FormPage } from '@/components/layout/FormPage';
import { useIsDesktop } from '@/hooks/useViewport';

export default function JoinGroup() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { services } = useApp();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const snapshot = await services.api.joinWithCode(code.trim());
      await services.engine.sync();
      router.replace({ pathname: '/groups/[id]', params: { id: snapshot.id } });
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
    <FormPage title="Join group" desktopTitle="Join with a code" width={460} onClose={() => router.back()} primary={{ label: 'Join group', onPress: join, disabled: code.trim().length === 0, loading: busy }}>
        {desktop ? (
          <Text tone="muted">Enter the 8-character code from the invite.</Text>
        ) : (
          <View className="items-center gap-2 px-4 py-4">
            <View className="h-16 w-16 items-center justify-center rounded-pill bg-tint">
              <Icon icon={UserPlus} size={34} strokeWidth={1.8} tone="accent" />
            </View>
            <Text variant="section" accessibilityRole="header">Got an invitation?</Text>
            <Text tone="muted" className="text-center leading-[22px]">Enter the code a friend sent you. You will be added right away and can see the group on all your devices.</Text>
          </View>
        )}
        {problem ? <Banner tone="error" message={problem} /> : null}
        {desktop ? (
          <CodeBoxes value={code} onChange={setCode} onSubmit={() => code.trim() && void join()} />
        ) : (
          <FieldLayoutProvider layout="stacked">
            <FieldGroup>
              <FieldRow label="Invitation code" value={code} onChangeText={setCode} placeholder="Paste code" autoCapitalize="characters" autoCorrect={false} autoFocus onSubmitEditing={() => code.trim() && void join()} />
            </FieldGroup>
          </FieldLayoutProvider>
        )}
          </FormPage>
  );
}
