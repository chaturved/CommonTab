import { Pressable, Text } from 'react-native';

const DEEP = '#06222B';
const MINT = '#8FE5C7';

const LOOK = {
  fill: { backgroundColor: MINT, borderColor: MINT, color: DEEP },
  dark: { backgroundColor: DEEP, borderColor: DEEP, color: '#FFFFFF' },
  outline: { backgroundColor: 'transparent', borderColor: '#0E1A1C', color: '#0E1A1C' },
  invert: { backgroundColor: 'transparent', borderColor: '#FFFFFF', color: '#FFFFFF' },
} as const;

export function Pill({ label, onPress, look, role = 'button' }: { label: string; onPress: () => void; look: keyof typeof LOOK; role?: 'button' | 'link' }) {
  const { color, ...box } = LOOK[look];
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      onPress={onPress}
      className="active:opacity-80"
      style={{ minHeight: 48, paddingHorizontal: 22, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', ...box }}
    >
      <Text style={{ fontSize: 15, lineHeight: 15, fontWeight: '500', color }}>{label}</Text>
    </Pressable>
  );
}
