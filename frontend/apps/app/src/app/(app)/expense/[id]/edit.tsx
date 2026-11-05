import { useRouteParam } from '@/hooks/useRouteParam';
import { View } from 'react-native';
import { Text } from '@commontab/ui';
import { ExpenseFormView } from '@/components/expense/ExpenseFormView';
import { Screen } from '@/components/layout/Screen';
import { useGroups } from '@/hooks/useGroups';
import { useIsDesktop } from '@/hooks/useViewport';

export default function EditExpense() {
  const desktop = useIsDesktop();
  const id = useRouteParam('id');
  const { ready, groups } = useGroups();
  const data = groups.find((g) => g.expenses.some((e) => e.id === id));
  const expense = data?.expenses.find((e) => e.id === id);

  if (desktop && data && expense && !expense.deletedAt) return <ExpenseFormView key={expense.id} mode="edit" data={data} expense={expense} />;

  return (
    <Screen wide>
      {data && expense && !expense.deletedAt ? (
        <ExpenseFormView key={expense.id} mode="edit" data={data} expense={expense} />
      ) : ready ? (
        <View className="items-center gap-2 px-6 py-10">
          <Text variant="section" className="text-center">Expense not found</Text>
          <Text tone="muted" className="text-center">It may have been deleted.</Text>
        </View>
      ) : null}
    </Screen>
  );
}
