import '../global.css';
import { Stack } from 'expo-router';
import { AppProvider, useApp } from '../src/app-context';

function Routes() {
  const { user } = useApp();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={user !== null}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={user === null}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="gallery" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProvider fallback={null}>
      <Routes />
    </AppProvider>
  );
}
