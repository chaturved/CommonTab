import { View } from 'react-native';
import Svg, { ClipPath, Circle, Defs } from 'react-native-svg';
import { Text } from '@commontab/ui';

export function LogoMark({ size = 30, id = 'logo' }: { size?: number; id?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <Defs>
        <ClipPath id={id}><Circle cx={36} cy={48} r={28} /></ClipPath>
      </Defs>
      <Circle cx={36} cy={48} r={28} fill="#0B4350" />
      <Circle cx={60} cy={48} r={28} fill="#3FAF96" />
      <Circle cx={60} cy={48} r={28} fill="#8FE5C7" clipPath={`url(#${id})`} />
    </Svg>
  );
}

export function Wordmark({ size = 20, light }: { size?: number; light?: boolean }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="flex-row items-center gap-2.5">
      <LogoMark size={size + 10} />
      <Text variant="screen-title" tone={light ? 'white' : 'fg'} accessibilityRole="header" aria-label="CommonTab" style={{ fontSize: size, letterSpacing: -0.04 * size }}>
        <Text variant="screen-title" tone={light ? 'white' : 'fg'} className="font-bold" style={{ fontSize: size }}>Common</Text>
        <Text variant="screen-title" tone={light ? 'white' : 'fg'} className="font-normal" style={{ fontSize: size }}>Tab</Text>
      </Text>
    </View>
  );
}
