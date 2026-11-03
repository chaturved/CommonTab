import { ReactNode } from 'react';
import { View } from 'react-native';
import { BackButton, Button, Text } from '@commontab/ui';
import { useIsDesktop } from '../layout';
import { DesktopDialog } from './DesktopDialog';
import { Screen } from './Screen';

export interface FormPageProps {
  title: string;
  onClose: () => void;
  leading?: 'back' | 'cancel';
  closeLabel?: string;
  trailing?: 'done';
  primary?: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
  children: ReactNode;
}

export function FormPage({ title, onClose, leading = 'cancel', trailing, closeLabel = 'Cancel', primary, children }: FormPageProps) {
  const desktop = useIsDesktop();
  if (desktop) {
    return (
      <DesktopDialog title={title} onClose={onClose} secondaryLabel={trailing === 'done' ? 'Done' : closeLabel} primary={primary}>
        {children}
      </DesktopDialog>
    );
  }
  return (
    <Screen wide footer={primary ? <View className="w-full max-w-[560px] self-center"><Button label={primary.label} loading={primary.loading} disabled={primary.disabled} onPress={primary.onPress} /></View> : undefined}>
      <View className="min-h-touch w-full max-w-[560px] flex-row items-center justify-between self-center">
        {leading === 'back' ? <BackButton onPress={onClose} /> : trailing === 'done' ? <View className="w-[72px]" /> : <Button label={closeLabel} variant="ghost" size="small" onPress={onClose} />}
        <Text variant="screen-title" accessibilityRole="header">{title}</Text>
        {trailing === 'done' ? <Button label="Done" variant="ghost" size="small" onPress={onClose} /> : <View className={leading === 'back' ? 'w-11' : 'w-[72px]'} />}
      </View>
      <View className="w-full max-w-[560px] gap-4 self-center">{children}</View>
    </Screen>
  );
}
