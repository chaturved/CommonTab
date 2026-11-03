import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { BackButton, Text } from '@commontab/ui';
import { Screen } from '../../src/components/Screen';

export default function AddExpense() {
  const router = useRouter();
  return (
    <Screen>
      <View className="flex-row items-center pt-1">
        <BackButton onPress={() => router.back()} />
      </View>
      <View className="gap-2 px-2 pt-2">
        <Text variant="large-title" accessibilityRole="header">Add expense</Text>
        <Text tone="muted">Adding expenses arrives in the next step.</Text>
      </View>
    </Screen>
  );
}
