import { View } from 'react-native';
import { Button, Text } from '@commontab/ui';

interface Props {
  desktop: boolean;
  label: string;
  summary: string;
  ready: boolean;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  cancelLabel?: string;
}

export function ExpenseActionBar({ desktop, label, summary, ready, busy, onCancel, onSave, cancelLabel = 'Cancel' }: Props) {
  if (!desktop) return <Button label={label} loading={busy} disabled={!ready} onPress={onSave} />;
  return (
    <View className="w-full max-w-[960px] flex-row items-center justify-between gap-4 self-start rounded-card border border-divider bg-card px-5 py-3" style={{ boxShadow: '0 -10px 28px rgba(0,0,0,0.10)' } as never}>
      <Text variant="body-small" tone={ready ? 'fg-soft' : 'muted'} accessibilityLiveRegion="polite" numberOfLines={2} className="min-w-0 flex-1">{summary}</Text>
      <View className="flex-row gap-2.5">
        <Button label={cancelLabel} variant="secondary" size="small" onPress={onCancel} />
        <Button label={label} size="small" loading={busy} disabled={!ready} onPress={onSave} />
      </View>
    </View>
  );
}
