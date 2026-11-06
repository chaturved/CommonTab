import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Icon, Text } from '@commontab/ui';
import { isoDate, monthCells, parseIsoDate, shiftMonth } from '@/lib/calendar';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  value: string;
  today: string;
  onSelect: (date: string) => void;
}

export function Calendar({ value, today, onSelect }: Props) {
  const chosen = parseIsoDate(value) ?? parseIsoDate(today)!;
  const [visible, setVisible] = useState({ year: chosen.year, month: chosen.month });
  const cells = monthCells(visible.year, visible.month);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const label = new Date(visible.year, visible.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const move = (by: number) => setVisible((v) => shiftMonth(v.year, v.month, by));

  return (
    <View className="gap-1">
      <View className="min-h-touch flex-row items-center justify-between">
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => move(-1)} className="h-11 w-11 items-center justify-center rounded-pill active:opacity-80">
          <Icon icon={ChevronLeft} size={20} strokeWidth={2.2} tone="muted" />
        </Pressable>
        <Text variant="body" accessibilityRole="header" className="font-bold">{label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => move(1)} className="h-11 w-11 items-center justify-center rounded-pill active:opacity-80">
          <Icon icon={ChevronRight} size={20} strokeWidth={2.2} tone="muted" />
        </Pressable>
      </View>
      <View className="flex-row">
        {WEEKDAYS.map((day, i) => (
          <View key={i} className="h-8 flex-1 items-center justify-center">
            <Text variant="caption" tone="muted" className="font-bold">{day}</Text>
          </View>
        ))}
      </View>
      {weeks.map((week, row) => (
        <View key={row} className="flex-row">
          {week.map((day, col) => {
            if (day === null) return <View key={col} className="h-10 flex-1" />;
            const iso = isoDate(visible.year, visible.month, day);
            const selected = iso === value;
            const isToday = iso === today;
            return (
              <Pressable
                key={col}
                accessibilityRole="button"
                accessibilityLabel={new Date(visible.year, visible.month, day).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                accessibilityState={{ selected }}
                onPress={() => onSelect(iso)}
                className="h-10 flex-1 items-center justify-center active:opacity-80"
              >
                <View className={`h-9 w-9 items-center justify-center rounded-pill ${selected ? 'bg-primary' : isToday ? 'border-[1.5px] border-accent' : ''}`}>
                  <Text variant="body-small" tone={selected ? 'on-primary' : 'fg'} className={selected || isToday ? 'font-bold' : undefined}>{day}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
