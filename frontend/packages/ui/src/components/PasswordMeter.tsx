import { View } from 'react-native';
import { cx } from '../theme';
import { Text } from './Text';

export interface PasswordMeterProps {
  length: number;
  required: number;
  className?: string;
}

export function PasswordMeter({ length, required, className }: PasswordMeterProps) {
  const missing = Math.max(0, required - length);
  const done = missing === 0;
  const fraction = Math.min(1, length / required);
  const summary = `${Math.min(length, required)} of ${required} characters`;
  const remaining = done ? 'Long enough' : `${missing} more to go`;
  return (
    <View accessible accessibilityLabel={`${summary}. ${remaining}`} className={cx('gap-2', className)}>
      <View className="h-1.5 overflow-hidden rounded-pill bg-divider" importantForAccessibility="no-hide-descendants">
        <View testID="password-meter-fill" className={cx('h-1.5', done ? 'bg-accent' : 'bg-warn-icon')} style={{ width: `${Math.round(fraction * 100)}%` }} />
      </View>
      <View className="flex-row justify-between" importantForAccessibility="no-hide-descendants">
        <Text variant="caption" tone="muted" className="text-[13px]">{summary}</Text>
        <Text variant="caption" tone="muted" className="text-[13px]">{remaining}</Text>
      </View>
    </View>
  );
}
