import { ComponentRef, useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text, useThemeColors } from '@commontab/ui';

export const CODE_LENGTH = 8;

export const cleanCode = (text: string): string => text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

export function CodeBoxes({ value, onChange, onSubmit }: { value: string; onChange: (code: string) => void; onSubmit?: () => void }) {
  const colors = useThemeColors();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const chars = value.padEnd(CODE_LENGTH, ' ').split('');
  return (
    <Pressable accessible={false} onPress={() => input.current?.focus()} className="relative flex-row items-center justify-center gap-2">
      {chars.map((char, i) => (
        <View key={i} className="flex-row items-center gap-2">
          {i === CODE_LENGTH / 2 ? <Text variant="large-title" tone="muted" className="text-2xl">–</Text> : null}
          <View className="h-14 w-10 items-center justify-center rounded-input border bg-card" style={{ borderColor: i === Math.min(value.length, CODE_LENGTH - 1) ? colors.accent : colors['field-border'], borderWidth: i === Math.min(value.length, CODE_LENGTH - 1) ? 2 : 1 }}>
            <Text variant="large-title" accessibilityElementsHidden className="text-2xl">{char.trim()}</Text>
          </View>
        </View>
      ))}
      <TextInput
        ref={input}
        accessibilityLabel="Invitation code"
        value={value}
        onChangeText={(text) => onChange(cleanCode(text))}
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        onSubmitEditing={onSubmit}
        className="absolute inset-0 text-transparent opacity-0"
        style={{ outlineStyle: 'none' } as never}
      />
    </Pressable>
  );
}
