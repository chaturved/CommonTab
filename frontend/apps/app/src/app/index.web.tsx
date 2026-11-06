import { Redirect } from 'expo-router';
import { useSession } from '@/context/AppContext';
import { Landing } from '@/components/landing/Landing';

export default function Root() {
  const { user, justSignedIn } = useSession();
  if (user && justSignedIn) return <Redirect href="/home" />;
  return <Landing signedIn={user !== null} />;
}
