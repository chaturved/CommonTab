import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { cx } from '../theme';

export type TextVariant =
  | 'large-title'
  | 'balance'
  | 'section'
  | 'screen-title'
  | 'button'
  | 'body'
  | 'body-small'
  | 'label'
  | 'caption';

// Full class names so Tailwind can see them. One color class per Text: Tailwind's CSS order,
// not class order, decides conflicts, so color is chosen through `tone`, never stacked.
const TONE = {
  fg: 'text-fg',
  'fg-soft': 'text-fg-soft',
  muted: 'text-muted',
  tab: 'text-tab',
  accent: 'text-accent',
  owe: 'text-owe',
  'on-tint': 'text-on-tint',
  'on-primary': 'text-on-primary',
  'on-warn': 'text-on-warn',
  'on-error': 'text-on-error',
  'hero-to': 'text-hero-to',
  'hero-muted': 'text-hero-muted',
  mint: 'text-mint',
  white: 'text-white',
} as const;

export type TextTone = keyof typeof TONE;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Layout and spacing only; use `tone` for color. */
  className?: string;
}

const VARIANT: Record<TextVariant, string> = {
  'large-title': 'text-large-title',
  balance: 'text-balance',
  section: 'text-section',
  'screen-title': 'text-screen-title',
  button: 'text-button',
  body: 'text-body',
  'body-small': 'text-body-small',
  label: 'text-label uppercase',
  caption: 'text-caption',
};

export function Text({ variant = 'body', tone = 'fg', className, style, ...props }: TextProps) {
  return (
    <RNText
      className={cx(VARIANT[variant], TONE[tone], className)}
      // DESIGN.md: labels are 13/700 caps with 0.08em tracking
      style={variant === 'label' ? [{ letterSpacing: 13 * 0.08 }, style] : style}
      {...props}
    />
  );
}
