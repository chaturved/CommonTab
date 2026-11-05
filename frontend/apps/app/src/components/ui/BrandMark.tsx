import { useId } from 'react';
import { Text as RNText, View, type TextStyle } from 'react-native';
import Svg, { ClipPath, Circle, Defs } from 'react-native-svg';

export function BrandMark({ size }: { size: number }) {
  const clip = `overlap-${useId().replace(/:/g, '')}`;
  return (
    <View aria-hidden>
      <Svg width={size} height={size} viewBox="0 0 96 96">
        <Defs>
          <ClipPath id={clip}><Circle cx={36} cy={48} r={28} /></ClipPath>
        </Defs>
        <Circle cx={36} cy={48} r={28} fill="#2D8F86" />
        <Circle cx={60} cy={48} r={28} fill="#5FD3B3" />
        <Circle cx={60} cy={48} r={28} fill="#E8FFF6" clipPath={`url(#${clip})`} />
      </Svg>
    </View>
  );
}

export function Wordmark({ size, color, style }: { size: number; color: string; style?: TextStyle }) {
  return (
    <RNText accessibilityRole="header" aria-label="CommonTab" style={[{ color, fontSize: size, letterSpacing: -size * 0.04 }, style]}>
      <RNText style={{ fontWeight: '700' }}>Common</RNText>
      <RNText style={{ fontWeight: '400' }}>Tab</RNText>
    </RNText>
  );
}
