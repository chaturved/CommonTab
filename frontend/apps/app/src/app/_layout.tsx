import '../../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { AppProvider, useSession } from '@/context/AppContext';
import { markHydrated } from '@/hooks/useViewport';

function Routes() {
  const { ready, user } = useSession();
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
  useEffect(markHydrated, []);
  return (
    <AppProvider>
      <Routes />
    </AppProvider>
  );
}
