import { Check } from 'lucide-react-native';
import { Pressable, ScrollView } from 'react-native';
import { Icon, Text } from '@commontab/ui';

export interface SelectOption { id: string; label: string }

export function OptionList({ options, selectedId, onSelect }: { options: SelectOption[]; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" className="shrink">
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <Pressable key={option.id} accessibilityRole="button" accessibilityLabel={`${option.label}${selected ? ', selected' : ''}`} onPress={() => onSelect(option.id)} className="min-h-[44px] flex-row items-center gap-3 px-3.5 active:opacity-80">
            <Text variant="body-small" className={`flex-1 ${selected ? 'font-bold' : ''}`}>{option.label}</Text>
            {selected ? <Icon icon={Check} size={16} strokeWidth={2.6} tone="accent" /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
