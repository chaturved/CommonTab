import '../../global.css';
import { useEffect } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { AppProvider, useSession } from '@/context/AppContext';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
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

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <ErrorScreen title="Something went wrong" message="Your data is safe on this device. Try again." actionLabel="Try again" onAction={retry} />;
}

export default function RootLayout() {
  useEffect(markHydrated, []);
  return (
    <AppProvider>
      <Routes />
    </AppProvider>
  );
}
