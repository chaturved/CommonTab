import { Pressable, PressableProps } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { Icon } from './Icon';

export function BackButton({ accessibilityLabel = 'Back', ...props }: Omit<PressableProps, 'children'>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      className="h-11 w-11 items-center justify-center rounded-pill bg-card active:opacity-80"
      style={{ shadowColor: '#0E1A1C', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}
      {...props}
    >
      <Icon icon={ChevronLeft} size={22} strokeWidth={2} tone="accent" />
    </Pressable>
  );
}
