import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { BackButton, Button, Text } from '@commontab/ui';
import { ChooseGroup } from '../../src/components/ChooseGroup';
import { ExpenseFormView } from '../../src/components/ExpenseFormView';
import { Screen } from '../../src/components/Screen';
import { useGroups } from '../../src/data';
import { useIsDesktop } from '../../src/layout';
import { DesktopDialog } from '../../src/components/DesktopDialog';

export default function AddExpense() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { group: groupParam, amount } = useLocalSearchParams<{ group?: string; amount?: string }>();
  const { ready, groups: all } = useGroups();
  const groups = all.filter((g) => !g.summary.closed);
  const [picked, setPicked] = useState<string | null>(null);
  const id = picked ?? groupParam ?? (groups.length === 1 ? groups[0]!.group.id : null);
  const data = groups.find((g) => g.group.id === id);

  if (!ready) return <Screen wide>{null}</Screen>;

  if (groups.length === 0 && desktop) {
    return (
      <DesktopDialog title="Create a group first" onClose={() => router.back()} primary={{ label: 'Create a group', onPress: () => router.replace('/create-group') }}>
        <Text tone="muted">Expenses live in a group, so make one to start splitting.</Text>
      </DesktopDialog>
    );
  }

  if (groups.length === 0) {
    return (
      <Screen wide>
        <View className="flex-row items-center pt-1"><BackButton onPress={() => router.back()} /></View>
        <View className="items-center gap-3 px-6 py-10">
          <Text variant="section" className="text-center">Create a group first</Text>
          <Text tone="muted" className="text-center">Expenses live in a group, so make one to start splitting.</Text>
          <Button label="Create a group" onPress={() => router.replace('/create-group')} />
        </View>
      </Screen>
    );
  }

  if (!data && desktop) {
    return (
      <DesktopDialog title="Add expense to…" onClose={() => router.back()} secondaryLabel="Cancel">
        <ChooseGroup groups={groups} onPick={setPicked} onCreate={() => router.replace('/create-group')} hideHeading />
      </DesktopDialog>
    );
  }

  if (!data) {
    return (
      <Screen wide>
        <View className="w-full max-w-[560px] self-center">
          <ChooseGroup groups={groups} onPick={setPicked} onCreate={() => router.replace('/create-group')} />
        </View>
      </Screen>
    );
  }

  const form = <ExpenseFormView key={data!.group.id} mode="add" data={data!} groups={groups} onPickGroup={setPicked} initial={amount ? { amountText: amount } : undefined} />;
  return desktop ? form : <Screen wide>{form}</Screen>;
}
