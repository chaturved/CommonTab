import { ReactNode } from 'react';
import { View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../tokens';

export interface HeroProps extends ViewProps {
  children: ReactNode;
  className?: string;
}

/**
 * Dark teal gradient card for the balance summary. The hero colors are the same in light and dark
 * (DESIGN.md), so the gradient does not depend on the color scheme.
 */
export function Hero({ children, className, style, ...props }: HeroProps) {
  return (
    <View className={className} style={[{ borderRadius: radius.hero, overflow: 'hidden' }, style]} {...props}>
      {/* ~160deg: top-left to bottom-right, steeper than 45deg */}
      <LinearGradient colors={[colors.light['hero-from'], colors.light['hero-to']]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ padding: 20, gap: 14 }}>
        {children}
      </LinearGradient>
    </View>
  );
}
