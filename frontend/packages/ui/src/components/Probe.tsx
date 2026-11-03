import { Text, View } from 'react-native';

/** Spike only: proves className, dark: and CSS variables work from a workspace package. */
export function Probe() {
  return (
    <View className="rounded-card bg-white p-4 dark:bg-slate-800">
      <Text className="text-lg font-bold text-[color:var(--probe)] dark:text-white">NativeWind probe</Text>
    </View>
  );
}
