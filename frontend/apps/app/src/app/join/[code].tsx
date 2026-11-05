import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSession } from '@/context/AppContext';
import { Splash } from '@/components/ui/Splash';

export default function JoinLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { ready, user, setPendingJoinCode } = useSession();
  if (!ready) return <Splash />;
  if (user) return <Redirect href={{ pathname: '/join', params: { code } }} />;
  setPendingJoinCode(code);
  return <Redirect href="/create-account" />;
}
