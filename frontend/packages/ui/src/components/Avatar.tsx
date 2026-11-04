import { View } from 'react-native';
import { avatarColors } from '../tokens';
import { cx } from '../theme';
import { Text } from './Text';

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0] as string)[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1] as string)[0] ?? '') : (Array.from(words[0] as string)[1] ?? '');
  return (first + last).toUpperCase();
}

export function avatarColorIndex(key: string): number {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash % avatarColors.length;
}

export interface AvatarProps {
  name: string;
  id?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function Avatar({ name, id, size = 'sm', className }: AvatarProps) {
  const swatch = avatarColors[avatarColorIndex(id ?? name)]!;
  const box = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={{ backgroundColor: swatch.bg }}
      className={cx('items-center justify-center rounded-pill border-2 border-card', box, className)}
    >
      <Text variant="caption" className={cx('font-bold', size === 'sm' ? 'text-[11px]' : 'text-[14px]')} style={{ color: swatch.fg }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export interface AvatarStackProps {
  members: readonly { id: string; name: string }[];
  max?: number;
  className?: string;
}

export function AvatarStack({ members, max = 3, className }: AvatarStackProps) {
  const overflow = members.length > max;
  const shown = overflow ? members.slice(0, max - 1) : members;
  const extra = members.length - shown.length;
  return (
    <View accessible accessibilityLabel={`Members: ${members.map((m) => m.name).join(', ')}`} className={cx('flex-row items-center', className)}>
      {shown.map((member, index) => (
        <View key={member.id} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden className={index > 0 ? '-ml-2.5' : ''}>
          <Avatar name={member.name} id={member.id} />
        </View>
      ))}
      {overflow ? (
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden className="-ml-2.5 h-8 w-8 items-center justify-center rounded-pill border-2 border-card bg-divider">
          <Text variant="caption" tone="fg-soft" className="text-[11px] font-bold">
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
