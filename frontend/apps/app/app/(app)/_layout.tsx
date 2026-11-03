import { Stack } from 'expo-router';
import { SessionExpiredSheet } from '../../src/auth/SessionExpiredSheet';

export default function AppLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create-group" options={{ presentation: 'modal' }} />
      </Stack>
      <SessionExpiredSheet />
    </>
  );
}
