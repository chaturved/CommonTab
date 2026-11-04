import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, PressableProps } from 'react-native';
import { cx } from '../theme';
import { Text, TextTone } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'hero' | 'hero-outline' | 'mint';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'accessibilityLabel'> {
  label: string;
  variant?: ButtonVariant;
  size?: 'large' | 'small';
  icon?: ReactNode;
  loading?: boolean;
  accessibilityLabel?: string;
  className?: string;
}

const BOX: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  secondary: 'border-[1.5px] border-accent',
  ghost: '',
  hero: 'bg-white',
  'hero-outline': 'border-[1.5px] border-white/50',
  mint: 'bg-mint',
};

const TONE: Record<ButtonVariant, TextTone> = {
  primary: 'on-primary',
  secondary: 'accent',
  ghost: 'accent',
  hero: 'hero-to',
  'hero-outline': 'white',
  mint: 'site-bg',
};

const SPINNER: Record<ButtonVariant, string> = { primary: '#FFFFFF', secondary: '#0B6B58', ghost: '#0B6B58', hero: '#06222B', 'hero-outline': '#FFFFFF', mint: '#061A20' };

export function Button({ label, variant = 'primary', size = 'large', icon, loading, disabled, accessibilityLabel, className, ...props }: ButtonProps) {
  const inactive = Boolean(disabled || loading);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      className={cx(
        'flex-row items-center justify-center gap-2 active:opacity-80',
        variant === 'ghost' ? 'min-h-touch px-2' : cx('rounded-pill px-5', size === 'large' ? 'min-h-button' : 'min-h-button-small'),
        BOX[variant],
        inactive && 'opacity-50',
        className,
      )}
      {...props}
    >
      {loading ? <ActivityIndicator accessibilityElementsHidden color={SPINNER[variant]} /> : icon}
      <Text variant={variant === 'ghost' ? 'body-small' : 'button'} tone={TONE[variant]} className={variant === 'ghost' ? 'font-semibold' : undefined}>
        {label}
      </Text>
    </Pressable>
  );
}
