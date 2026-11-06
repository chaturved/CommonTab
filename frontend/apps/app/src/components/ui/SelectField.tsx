import { ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { Icon, Text, useThemeColors } from '@commontab/ui';
import { Dropdown } from '@/components/ui/Dropdown';

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

export function FieldDropdown({ label, value, width, content }: { label: string; value: string; width?: number; content: (close: () => void) => ReactNode }) {
  const colors = useThemeColors();
  return (
    <Dropdown label={label} width={width} content={content}>
      {(open, isOpen) => (
        <View className="gap-1.5">
          <Text variant="caption" tone="muted" className="text-[13px] font-bold" accessible={false}>{label}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} onPress={open} className="min-h-[44px] flex-row items-center justify-between gap-2 rounded-input border bg-card px-3.5 active:opacity-80" style={{ borderColor: colors['field-border'] }}>
            <Text variant="body" numberOfLines={1} className="min-w-0 flex-1">{value}</Text>
            <Icon icon={isOpen ? ChevronUp : ChevronDown} size={16} strokeWidth={2.2} tone="muted" />
          </Pressable>
        </View>
      )}
    </Dropdown>
  );
}

export function SelectField({ label, value, options, selectedId, onSelect }: { label: string; value: string; options: SelectOption[]; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <FieldDropdown label={label} value={value} content={(close) => <OptionList options={options} selectedId={selectedId} onSelect={(id) => { onSelect(id); close(); }} />} />
  );
}
