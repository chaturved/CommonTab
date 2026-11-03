import { ReactNode } from 'react';
import { View } from 'react-native';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react-native';
import { cx, useThemeColors } from '../theme';
import { Text, TextTone } from './Text';

export type BannerTone = 'warning' | 'error' | 'info';

export interface BannerProps {
  tone?: BannerTone;
  /** Bold lead-in, e.g. "You're offline." */
  title?: string;
  message: string;
  /** Replaces the default icon for the tone. */
  icon?: ReactNode;
  className?: string;
}

const BOX: Record<BannerTone, string> = { warning: 'bg-warn', error: 'bg-error', info: 'bg-tint' };
const TEXT: Record<BannerTone, TextTone> = { warning: 'on-warn', error: 'on-error', info: 'on-tint' };

/** Inline notice. Errors are announced as alerts; warnings and info as status. */
export function Banner({ tone = 'warning', title, message, icon, className }: BannerProps) {
  const colors = useThemeColors();
  const iconColor = { warning: colors['warn-icon'], error: colors['on-error'], info: colors['on-tint'] }[tone];
  const Icon = { warning: TriangleAlert, error: CircleAlert, info: Info }[tone];
  return (
    <View
      role={tone === 'error' ? 'alert' : 'status'}
      accessible
      accessibilityLabel={title ? `${title} ${message}` : message}
      className={cx('min-h-touch flex-row items-center gap-2.5 rounded-2xl px-3.5 py-2.5', BOX[tone], className)}
    >
      {icon ?? <Icon size={20} color={iconColor} strokeWidth={2} />}
      <Text variant="caption" tone={TEXT[tone]} className="flex-1 text-[13px] leading-[18px]">
        {title ? <Text variant="caption" tone={TEXT[tone]} className="text-[13px] font-bold">{title} </Text> : null}
        {message}
      </Text>
    </View>
  );
}
