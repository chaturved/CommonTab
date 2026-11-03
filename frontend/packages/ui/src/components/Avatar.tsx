import { View } from 'react-native';
import { avatarColors } from '../tokens';
import { cx, useThemeColors } from '../theme';
import { Text } from './Text';

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0] as string)[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1] as string)[0] ?? '') : (Array.from(words[0] as string)[1] ?? '');
  return (first + last).toUpperCase();
}

/** Stable palette slot for a member, so a person keeps their color on every screen. */
export function avatarColorIndex(key: string): number {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash % avatarColors.length;
}

export interface AvatarProps {
  name: string;
  /** Stable member id; falls back to the name for choosing a color. */
  id?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function Avatar({ name, id, size = 'sm', className }: AvatarProps) {
  const colors = useThemeColors();
  const swatch = avatarColors[avatarColorIndex(id ?? name)]!;
  const box = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={{ backgroundColor: swatch.bg, borderColor: colors.card, borderWidth: 2, boxSizing: 'content-box' } as object}
      className={cx('items-center justify-center rounded-pill', box, className)}
    >
      <Text variant="caption" className={cx('font-bold', size === 'sm' ? 'text-[11px]' : 'text-[14px]')} style={{ color: swatch.fg }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export interface AvatarStackProps {
  members: readonly { id: string; name: string }[];
  /** Avatars shown before "+N". */
  max?: number;
  className?: string;
}

export function AvatarStack({ members, max = 3, className }: AvatarStackProps) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <View accessible accessibilityLabel={`Members: ${members.map((m) => m.name).join(', ')}`} className={cx('flex-row items-center', className)}>
      {shown.map((member, index) => (
        <View key={member.id} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden className={index > 0 ? '-ml-2.5' : ''}>
          <Avatar name={member.name} id={member.id} />
        </View>
      ))}
      {extra > 0 ? (
        <Text variant="caption" tone="muted" className="ml-1.5 font-bold">
          +{extra}
        </Text>
      ) : null}
    </View>
  );
}
