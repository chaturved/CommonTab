import { useState } from 'react';
import { Check, Search } from 'lucide-react-native';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Icon, Text, useThemeColors } from '@commontab/ui';

export interface SelectOption { id: string; label: string }

interface Props {
  options: SelectOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
  searchable?: boolean;
}

export function OptionList({ options, selectedId, onSelect, searchable }: Props) {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const shown = searchable && term ? options.filter((option) => option.label.toLowerCase().includes(term)) : options;
  const first = shown[0];

  return (
    <>
      {searchable ? (
        <View className="flex-row items-center gap-2 border-b border-divider px-3.5">
          <Icon icon={Search} size={16} strokeWidth={2.2} tone="muted" />
          <TextInput
            accessibilityLabel="Search"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => first && onSelect(first.id)}
            placeholder="Search"
            placeholderTextColor={colors.muted}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            className="min-h-[44px] min-w-0 flex-1 text-body text-fg"
            style={{ outlineStyle: 'none' } as never}
          />
        </View>
      ) : null}
      <ScrollView keyboardShouldPersistTaps="handled" className="shrink">
        {shown.map((option) => {
          const selected = option.id === selectedId;
          return (
            <Pressable key={option.id} accessibilityRole="button" accessibilityLabel={`${option.label}${selected ? ', selected' : ''}`} onPress={() => onSelect(option.id)} className="min-h-[44px] flex-row items-center gap-3 px-3.5 active:opacity-80">
              <Text variant="body-small" className={`flex-1 ${selected ? 'font-bold' : ''}`}>{option.label}</Text>
              {selected ? <Icon icon={Check} size={16} strokeWidth={2.6} tone="accent" /> : null}
            </Pressable>
          );
        })}
        {shown.length === 0 ? <Text variant="body-small" tone="muted" className="px-3.5 py-4">No match for “{query.trim()}”.</Text> : null}
      </ScrollView>
    </>
  );
}
