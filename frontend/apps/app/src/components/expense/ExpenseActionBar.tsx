import { View } from 'react-native';
import { Button, Text } from '@commontab/ui';

interface Props {
  desktop: boolean;
  label: string;
  summary: string;
  ready: boolean;
  busy: boolean;
  onSave: () => void;
  pinned?: boolean;
  flat?: boolean;
}

export function ExpenseActionBar({ desktop, label, summary, ready, busy, onSave, pinned = true, flat }: Props) {
  if (!desktop) return <Button label={label} loading={busy} disabled={!ready} onPress={onSave} />;
  if (flat) {
    return (
      <View className="w-full flex-row items-center justify-between gap-4">
        <Text variant="body-small" tone={ready ? 'fg-soft' : 'muted'} accessibilityLiveRegion="polite" numberOfLines={2} className="min-w-0 flex-1">{summary}</Text>
        <Button label={label} size="small" loading={busy} disabled={!ready} onPress={onSave} />
      </View>
    );
  }
  return (
    <View className="w-full max-w-[960px] flex-row items-center justify-between gap-4 self-start rounded-card border border-divider bg-card px-5 py-3" style={pinned ? ({ boxShadow: '0 -10px 28px rgba(0,0,0,0.10)' } as never) : undefined}>
      <Text variant="body-small" tone={ready ? 'fg-soft' : 'muted'} accessibilityLiveRegion="polite" numberOfLines={2} className="min-w-0 flex-1">{summary}</Text>
      <Button label={label} size="small" loading={busy} disabled={!ready} onPress={onSave} />
    </View>
  );
}
