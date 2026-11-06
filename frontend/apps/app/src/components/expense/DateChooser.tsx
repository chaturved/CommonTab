import { View } from 'react-native';
import { Button } from '@commontab/ui';
import { Calendar } from '@/components/ui/Calendar';
import { dayOffset } from '@/lib/dates';

interface Props {
  date: string;
  onChange: (date: string) => void;
  onDone: () => void;
}

export function DateChooser({ date, onChange, onDone }: Props) {
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
      <Calendar value={date} today={dayOffset(0)} onSelect={choose} />
    </>
  );
}
