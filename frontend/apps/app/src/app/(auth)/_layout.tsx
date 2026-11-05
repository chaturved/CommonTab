import { Stack } from 'expo-router';
import { useSession } from '@/context/AppContext';
import { Splash } from '@/components/ui/Splash';

export default function AuthLayout() {
  const { ready } = useSession();
  return ready ? <Stack screenOptions={{ headerShown: false }} /> : <Splash />;
}
