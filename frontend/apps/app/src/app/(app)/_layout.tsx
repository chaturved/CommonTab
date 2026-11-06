import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useApp, useSession } from '@/context/AppContext';
import { SessionExpiredSheet } from '@/components/auth/SessionExpiredSheet';
import { Splash } from '@/components/ui/Splash';
import { DesktopShell } from '@/components/layout/DesktopShell';
import { useIsDesktop } from '@/hooks/useViewport';

function AppShell() {
  const desktop = useIsDesktop();
  const { clearJustSignedIn } = useApp();
  useEffect(() => clearJustSignedIn(), [clearJustSignedIn]);
  const dialog = desktop ? ({ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } } as const) : ({ presentation: 'card' } as const);
  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create-group" options={desktop ? dialog : { presentation: 'modal' }} />
      <Stack.Screen name="add-expense" options={dialog} />
      <Stack.Screen name="join" options={dialog} />
      <Stack.Screen name="group/[id]/settle" options={dialog} />
      <Stack.Screen name="group/[id]/invite" options={dialog} />
      <Stack.Screen name="expense/[id]/edit" options={dialog} />
    </Stack>
  );
  return (
    <>
      {desktop ? <DesktopShell>{stack}</DesktopShell> : stack}
      <SessionExpiredSheet />
    </>
  );
}

export default function AppLayout() {
  const { ready } = useSession();
  return ready ? <AppShell /> : <Splash />;
}
