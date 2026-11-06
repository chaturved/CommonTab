import { Stack, useRouter } from 'expo-router';
import { ErrorScreen } from '@/components/layout/ErrorScreen';

export default function NotFound() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Page not found' }} />
      <ErrorScreen title="This page doesn't exist" message="The link may be old or mistyped." actionLabel="Go to CommonTab" onAction={() => router.replace('/')} />
    </>
  );
}
