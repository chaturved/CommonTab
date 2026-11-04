import { Redirect } from 'expo-router';
import { useSession } from '../src/app-context';
import { Landing } from '../src/landing/Landing';

export default function Root() {
  const { ready, user, justSignedIn } = useSession();
  if (!ready) return null;
  if (user && justSignedIn) return <Redirect href="/home" />;
  return <Landing signedIn={user !== null} />;
}
