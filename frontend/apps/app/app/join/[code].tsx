import { Redirect, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../src/app-context';

export default function JoinLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, setPendingJoinCode } = useApp();
  if (user) return <Redirect href={{ pathname: '/join', params: { code } }} />;
  setPendingJoinCode(code);
  return <Redirect href="/create-account" />;
}
