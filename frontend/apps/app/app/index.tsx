import { View } from 'react-native';
import { Button, Card, Text } from '@commontab/ui';

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-4">
      <Card className="gap-3 p-4">
        <Text variant="screen-title">CommonTab</Text>
        <Button label="Add expense" />
      </Card>
    </View>
  );
}
