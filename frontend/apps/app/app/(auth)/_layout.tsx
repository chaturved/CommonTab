import { Stack } from 'expo-router';
import { useSession } from '../../src/app-context';
import { Splash } from '../../src/components/Splash';

export default function AuthLayout() {
  const { ready } = useSession();
  return ready ? <Stack screenOptions={{ headerShown: false }} /> : <Splash />;
}
