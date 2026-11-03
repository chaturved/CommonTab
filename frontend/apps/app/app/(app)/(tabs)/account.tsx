import { View } from 'react-native';
import { Avatar, Button, Card, Text } from '@commontab/ui';
import { useApp } from '../../../src/app-context';
import { Screen } from '../../../src/components/Screen';

export default function Account() {
  const { user, signOut } = useApp();
  return (
    <Screen tabs>
      <View className="min-h-touch justify-center px-1">
        <Text variant="large-title" accessibilityRole="header">Account</Text>
      </View>
      <Card className="min-h-row-tall flex-row items-center gap-3.5 px-4 py-3">
        <Avatar name={user?.name ?? '?'} id={user?.id} size="md" />
        <View className="flex-1">
          <Text variant="body" className="font-semibold">{user?.name}</Text>
          <Text variant="caption" tone="muted" className="text-[13px]">{user?.email}</Text>
        </View>
      </Card>
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
