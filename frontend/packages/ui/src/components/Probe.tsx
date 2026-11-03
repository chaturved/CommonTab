import { Text, View } from 'react-native';

/** Spike only: proves token classes and light/dark variables work from a workspace package. */
export function Probe() {
  return (
    <View className="rounded-card bg-card p-4">
      <Text className="text-screen-title text-accent">NativeWind probe</Text>
    </View>
  );
}
