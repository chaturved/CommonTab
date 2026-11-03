import { Redirect } from 'expo-router';
import { useApp } from '../src/app-context';
import { Landing } from '../src/landing/Landing';

export default function Root() {
  const { user, justSignedIn } = useApp();
  if (user && justSignedIn) return <Redirect href="/home" />;
  return <Landing signedIn={user !== null} />;
}
