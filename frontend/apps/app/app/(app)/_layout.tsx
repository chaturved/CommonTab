import { Stack } from 'expo-router';
import { SessionExpiredSheet } from '../../src/auth/SessionExpiredSheet';
import { DesktopShell } from '../../src/components/DesktopShell';
import { useIsDesktop } from '../../src/layout';

export default function AppLayout() {
  const desktop = useIsDesktop();
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
