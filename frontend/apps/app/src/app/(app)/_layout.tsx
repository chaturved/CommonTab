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
      <Stack.Screen name="groups/new" options={desktop ? dialog : { presentation: 'modal' }} />
      <Stack.Screen name="expenses/new/index" options={dialog} />
      <Stack.Screen name="expenses/new/split" />
      <Stack.Screen name="groups/join" options={dialog} />
      <Stack.Screen name="groups/[id]/settle" options={dialog} />
      <Stack.Screen name="groups/[id]/invite" options={dialog} />
      <Stack.Screen name="expenses/[id]/edit/index" options={dialog} />
      <Stack.Screen name="expenses/[id]/edit/split" />
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
