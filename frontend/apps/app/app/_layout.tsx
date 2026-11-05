import '../global.css';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@commontab/ui';
import { AppProvider, useSession } from '../src/app-context';

function Routes() {
  const { ready, user } = useSession();
  if (!ready) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="Loading CommonTab" className="flex-1 items-center justify-center bg-site-bg">
        <Text tone="site-text" className="text-2xl font-semibold">CommonTab</Text>
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!ready || user !== null}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!ready || user === null}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="gallery" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <Routes />
    </AppProvider>
  );
}
