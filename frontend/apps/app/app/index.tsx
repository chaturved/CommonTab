import { Redirect } from 'expo-router';
import { useApp } from '../src/app-context';

export default function Root() {
  const { user } = useApp();
  return <Redirect href={user ? '/home' : '/welcome'} />;
}
