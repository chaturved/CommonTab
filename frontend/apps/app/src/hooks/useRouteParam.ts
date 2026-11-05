import { useLocalSearchParams } from 'expo-router';

export function useRouteParam(name: string): string {
  const value = useLocalSearchParams<Record<string, string | string[]>>()[name];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}
