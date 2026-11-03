import { ComponentType } from 'react';
import { Pressable, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { cx, useThemeColors } from '../theme';
import { Text } from './Text';

export interface TabItem {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

export interface TabBarProps {
  /** The four tabs, in order. The Add button sits in the middle, after the second tab. */
  tabs: readonly TabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onAdd: () => void;
  addLabel?: string;
  className?: string;
}

/** Floating pill tab bar: Home, Groups, [+], Activity, Account. */
export function TabBar({ tabs, activeKey, onSelect, onAdd, addLabel = 'Add expense', className }: TabBarProps) {
  const colors = useThemeColors();
  const renderTab = (tab: TabItem) => {
    const selected = tab.key === activeKey;
    const color = selected ? colors.accent : colors.tab;
    return (
      <Pressable
        key={tab.key}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected }}
        onPress={() => onSelect(tab.key)}
        className={cx('min-h-touch flex-1 items-center justify-center gap-0.5 rounded-[26px]', selected && 'bg-tint-selected')}
      >
        <tab.icon size={22} color={color} strokeWidth={1.9} />
        <Text variant="caption" className={cx('text-[11px]', selected ? 'font-bold' : 'font-semibold')} style={{ color }}>
          {tab.label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View accessibilityRole="tablist" className={cx('min-h-16 flex-row gap-0.5 rounded-pill bg-card p-1.5 shadow-lg', className)}>
      {tabs.slice(0, 2).map(renderTab)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        onPress={onAdd}
        className="mx-1 h-[52px] w-[52px] items-center justify-center self-center rounded-pill bg-primary active:opacity-80"
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2.4} />
      </Pressable>
      {tabs.slice(2).map(renderTab)}
    </View>
  );
}
