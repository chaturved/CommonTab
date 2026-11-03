import { ComponentType } from 'react';
import { Pressable, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { cx } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface TabItem {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

export interface TabBarProps {
  tabs: readonly TabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onAdd: () => void;
  addLabel?: string;
  className?: string;
}

export function TabBar({ tabs, activeKey, onSelect, onAdd, addLabel = 'Add expense', className }: TabBarProps) {
  const renderTab = (tab: TabItem) => {
    const selected = tab.key === activeKey;
    return (
      <Pressable
        key={tab.key}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected }}
        onPress={() => onSelect(tab.key)}
        className={cx('min-h-touch flex-1 items-center justify-center gap-0.5 rounded-[26px]', selected && 'bg-tint-selected')}
      >
        <Icon icon={tab.icon} size={22} strokeWidth={1.9} tone={selected ? 'accent' : 'tab'} />
        <Text variant="caption" tone={selected ? 'accent' : 'tab'} className={cx('text-[11px]', selected ? 'font-bold' : 'font-semibold')}>
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
        <Icon icon={Plus} size={24} strokeWidth={2.4} tone="on-primary" />
      </Pressable>
      {tabs.slice(2).map(renderTab)}
    </View>
  );
}
