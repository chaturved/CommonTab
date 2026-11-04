import { ReactNode } from 'react';
import { View } from 'react-native';
import { cx } from '../theme';
import { Text, TextTone } from './Text';

export type PillTone = 'accent' | 'warn' | 'owe' | 'neutral';

export interface PillProps {
  label: string;
  tone?: PillTone;
  icon?: ReactNode;
  className?: string;
}

const BOX: Record<PillTone, string> = {
  accent: 'bg-tint',
  warn: 'bg-warn',
  owe: 'bg-owe-tint',
  neutral: 'bg-divider',
};
const TONE: Record<PillTone, TextTone> = {
  accent: 'on-tint',
  warn: 'on-warn',
  owe: 'owe',
  neutral: 'fg-soft',
};

export function Pill({ label, tone = 'accent', icon, className }: PillProps) {
  return (
    <View className={cx('h-8 flex-row items-center gap-1.5 self-start rounded-pill px-3', BOX[tone], className)}>
      {icon}
      <Text variant="caption" tone={TONE[tone]} className="font-bold">
        {label}
      </Text>
    </View>
  );
}
