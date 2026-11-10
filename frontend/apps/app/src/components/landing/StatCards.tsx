import { Pressable, Text, View } from 'react-native';
import { DEVICE_CARDS } from '@/constants/landing';

const EDGE = 'rgba(143, 229, 199, 0.2)';

export function StatCards({ cta, onCta }: { cta: string; onCta: () => void }) {
  return (
    <View className="mt-10 flex-col gap-5 lg:mt-16 lg:flex-row">
      {DEVICE_CARDS.map((stat) => (
        <View key={stat.value} className="min-h-[260px] justify-between rounded-[56px] border p-8 lg:min-h-[335px] lg:flex-1" style={{ borderColor: EDGE }}>
          <Text style={{ fontSize: 44, lineHeight: 44, fontWeight: '300', letterSpacing: -1.76, color: '#E8F1F0' }}>{stat.value}</Text>
          <Text style={{ fontSize: 18, lineHeight: 21.6, letterSpacing: -0.36, color: '#E8F1F0' }}>{stat.body}</Text>
        </View>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel={cta} onPress={onCta} className="min-h-[260px] justify-between rounded-[56px] p-8 active:opacity-80 lg:min-h-[335px] lg:flex-1" style={{ backgroundColor: '#8FE5C7' }}>
        <Text style={{ fontSize: 42, lineHeight: 44, fontWeight: '300', letterSpacing: -1.68, color: '#06222B' }}>{cta}</Text>
        <Text style={{ fontSize: 44, lineHeight: 44, color: '#06222B' }}>→</Text>
      </Pressable>
    </View>
  );
}
