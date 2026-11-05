import { ReactNode } from 'react';
import { View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../tokens';

export interface HeroProps extends ViewProps {
  children: ReactNode;
  padding?: number;
  className?: string;
}

export function Hero({ children, className, style, padding = 20, ...props }: HeroProps) {
  return (
    <View className={className} style={[{ borderRadius: radius.hero, overflow: 'hidden' }, style]} {...props}>
      {/* ~160deg: top-left to bottom-right, steeper than 45deg */}
      <LinearGradient colors={[colors.light['hero-from'], colors.light['hero-to']]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ padding, gap: 14, flexGrow: 1 }}>
        {children}
      </LinearGradient>
    </View>
  );
}
