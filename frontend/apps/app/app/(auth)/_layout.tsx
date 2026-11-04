import { Stack } from 'expo-router';
import { useSession } from '../../src/app-context';

export default function AuthLayout() {
  const { ready } = useSession();
  return ready ? <Stack screenOptions={{ headerShown: false }} /> : null;
}
