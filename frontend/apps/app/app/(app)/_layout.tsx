import { Stack } from 'expo-router';
import { SessionExpiredSheet } from '../../src/auth/SessionExpiredSheet';
import { DesktopShell } from '../../src/components/DesktopShell';
import { useIsDesktop } from '../../src/layout';

export default function AppLayout() {
  const desktop = useIsDesktop();
  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create-group" options={{ presentation: desktop ? 'card' : 'modal' }} />
    </Stack>
  );
  return (
    <>
      {desktop ? <DesktopShell>{stack}</DesktopShell> : stack}
      <SessionExpiredSheet />
    </>
  );
}
