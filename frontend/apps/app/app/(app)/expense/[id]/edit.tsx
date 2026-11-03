import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@commontab/ui';
import { ExpenseFormView } from '../../../../src/components/ExpenseFormView';
import { Screen } from '../../../../src/components/Screen';
import { useGroups } from '../../../../src/data';

export default function EditExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, groups } = useGroups();
  const data = groups.find((g) => g.expenses.some((e) => e.id === id));
  const expense = data?.expenses.find((e) => e.id === id);

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
