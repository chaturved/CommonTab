import { View, ViewProps } from 'react-native';
import { cx } from '../theme';

export interface CardProps extends ViewProps {
  className?: string;
}

/** White (dark: #172227) rounded surface. Add padding and layout with classes. */
export function Card({ className, ...props }: CardProps) {
  return <View className={cx('rounded-card bg-card', className)} {...props} />;
}
