import { useRouter } from 'expo-router';

export function useGoBack(fallback: '/home' = '/home') {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace(fallback));
}
