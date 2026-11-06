import { Redirect } from 'expo-router';
import { useSession } from '@/context/AppContext';

export default function Root() {
  const { ready, user } = useSession();
  if (!ready) return null;
  return <Redirect href={user ? '/home' : '/welcome'} />;
}
