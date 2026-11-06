import { Redirect, type Href } from 'expo-router';
import { View } from 'react-native';
import { BackButton, Text } from '@commontab/ui';
import { ExpenseActionBar } from '@/components/expense/ExpenseActionBar';
import { SplitPanel } from '@/components/expense/SplitPanel';
import { Screen } from '@/components/layout/Screen';
import { useGoBack } from '@/hooks/useGoBack';
import { useSplitView } from '@/hooks/useSplitView';
import { useIsDesktop } from '@/hooks/useViewport';
import { useExpenseDraft } from '@/state/expenseDraft';

export function SplitScreen({ fallback }: { fallback: Href }) {
  const goBack = useGoBack();
  const desktop = useIsDesktop();
  const { draft, byItem } = useExpenseDraft();
  const view = useSplitView(draft, byItem);
  if (!view || desktop) return <Redirect href={fallback} />;

  return (
    <Screen wide footer={<ExpenseActionBar desktop={false} label="Done" summary={view.summary} ready={view.ready} busy={false} onSave={goBack} />}>
      <View className="min-h-touch flex-row items-center justify-between">
        <BackButton onPress={goBack} />
        <Text variant="screen-title" accessibilityRole="header">{view.title}</Text>
        <View className="w-11" />
      </View>
      <SplitPanel view={view} desktop={false} />
    </Screen>
  );
}
