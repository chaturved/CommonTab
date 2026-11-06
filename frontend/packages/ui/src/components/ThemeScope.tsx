import { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { vars } from 'nativewind';
import { ThemeScopeContext } from '../theme';
import { ColorScheme, colors } from '../tokens';

export function ThemeScope({ scheme, style, children }: { scheme: ColorScheme; style?: ViewStyle; children: ReactNode }) {
  const palette = vars(Object.fromEntries(Object.entries(colors[scheme]).map(([name, value]) => [`--c-${name}`, value])));
  return (
    <ThemeScopeContext.Provider value={scheme}>
      <View style={[{ flex: 1 }, palette, style]}>{children}</View>
    </ThemeScopeContext.Provider>
  );
}
