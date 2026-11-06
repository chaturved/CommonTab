import { Text, View } from 'react-native';
import { TALL_CARDS } from '@/constants/landing';

const SHELL = {
  mint: { backgroundColor: '#8FE5C7', color: '#06222B' },
  light: { backgroundColor: '#FFFFFF', color: '#000000' },
  deep: { backgroundImage: 'linear-gradient(160deg, #0B4350, #0C2A33)', color: '#FFFFFF' },
  tint: { backgroundImage: 'linear-gradient(160deg, #8FE5C7, #E6F1EE)', color: '#000000' },
} as const;

const OFFSET = ['', 'lg:mt-[31px]', 'lg:mt-[62px]', 'lg:mt-[93px]'];

export function TallCards() {
  return (
    <View className="mt-10 flex-col gap-5 lg:mt-20 lg:flex-row lg:items-start">
      {TALL_CARDS.map((card, index) => {
        const { color, ...box } = SHELL[card.tone];
        return (
          <View key={card.value} className={`min-h-[320px] justify-between rounded-[56px] p-9 lg:min-h-[460px] lg:flex-1 ${OFFSET[index]}`} style={box as never}>
            <Text className="leading-none" style={{ fontSize: 'clamp(40px, 4.4vw, 64px)', fontWeight: '500', letterSpacing: '-0.05em', color, fontVariant: ['tabular-nums'] } as never}>{card.value}</Text>
            <Text style={{ fontSize: 18, lineHeight: 22.5, letterSpacing: -0.36, color }}>{card.body}</Text>
          </View>
        );
      })}
    </View>
  );
}
