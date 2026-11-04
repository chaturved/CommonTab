import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { BackButton, Text } from '@commontab/ui';
import { ExpenseDetailContent } from '../../../../src/components/ExpenseDetail';
import { Screen } from '../../../../src/components/Screen';
import { useGroups } from '../../../../src/data';
import { useIsDesktop } from '../../../../src/layout';

export default function ExpenseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, groups } = useGroups();
  const data = groups.find((g) => g.expenses.some((e) => e.id === id));
  const expense = data?.expenses.find((e) => e.id === id);
  const desktop = useIsDesktop();
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  if (desktop && data) return <Redirect href={{ pathname: '/group/[id]', params: { id: data.group.id, expense: id } }} />;

  return (
    <Screen wide>
      <View className="min-h-touch w-full max-w-[560px] flex-row items-center justify-between self-center">
        <BackButton onPress={leave} />
        <Text variant="screen-title" accessibilityRole="header">Expense</Text>
        <View className="w-11" />
      </View>
      <View className="w-full max-w-[560px] self-center">
        {data && expense && !expense.deletedAt ? (
          <ExpenseDetailContent expense={expense} data={data} afterDelete={() => router.replace({ pathname: '/group/[id]', params: { id: data.group.id } })} />
        ) : ready ? (
          <View className="items-center gap-2 px-6 py-10">
            <Text variant="section" className="text-center">Expense not found</Text>
            <Text tone="muted" className="text-center">It may have been deleted.</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
