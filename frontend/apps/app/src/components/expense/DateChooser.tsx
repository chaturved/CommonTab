import { View } from 'react-native';
import { Button, FieldGroup, FieldRow, Text } from '@commontab/ui';
import { dayOffset } from '@/lib/dates';

interface Props {
  date: string;
  error?: string;
  onChange: (date: string) => void;
  onDone: () => void;
}

export function DateChooser({ date, error, onChange, onDone }: Props) {
  const choose = (value: string) => {
    onChange(value);
    onDone();
  };
  return (
    <>
      <View className="flex-row gap-2">
        <Button label="Today" variant="secondary" size="small" className="flex-1" onPress={() => choose(dayOffset(0))} />
        <Button label="Yesterday" variant="secondary" size="small" className="flex-1" onPress={() => choose(dayOffset(-1))} />
      </View>
      <FieldGroup>
        <FieldRow label="Date" value={date} onChangeText={onChange} placeholder="2026-10-30" autoCapitalize="none" last />
      </FieldGroup>
      {error ? <Text variant="caption" tone="owe">{error}</Text> : null}
      <Button label="Done" disabled={Boolean(error)} onPress={onDone} />
    </>
  );
}
