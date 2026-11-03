import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Button, Card, Sheet, Text } from '@commontab/ui';
import { useApp } from '../../../src/app-context';
import { PageHeader } from '../../../src/components/PageHeader';
import { Eyebrow } from '../../../src/components/Section';
import { Screen } from '../../../src/components/Screen';
import { useIsDesktop } from '../../../src/layout';
import { syncLabel } from '../../../src/syncLabel';
import { useSyncStatus } from '../../../src/useSyncStatus';

function SettingRow({ title, detail, action, divider }: { title: string; detail: string; action: React.ReactNode; divider?: boolean }) {
  return (
    <View className={`min-h-row-tall flex-row items-center gap-3.5 px-4 py-3 ${divider ? 'border-b border-divider' : ''}`}>
      <View className="flex-1">
        <Text variant="body" className="font-semibold">{title}</Text>
        <Text variant="caption" tone="muted" className="text-[13px]">{detail}</Text>
      </View>
      {action}
    </View>
  );
}

export default function Account() {
  const desktop = useIsDesktop();
  const { user, signOut } = useApp();
  const status = useSyncStatus();
  const [confirming, setConfirming] = useState(false);
  const unsynced = (status?.waiting ?? 0) + (status?.failed ?? 0) + (status?.conflicts ?? 0);
  const requestSignOut = () => (unsynced > 0 ? setConfirming(true) : void signOut());
  return (
    <Screen wide={desktop} tabs>
      {desktop ? (
        <PageHeader title="Account" />
      ) : (
        <View className="min-h-touch justify-center px-1">
          <Text variant="large-title" accessibilityRole="header">Account</Text>
        </View>
      )}
      <Card className="min-h-row-tall flex-row items-center gap-3.5 px-4 py-3">
        <Avatar name={user?.name ?? '?'} id={user?.id} size="md" />
        <View className="flex-1">
          <Text variant="body" className="font-semibold">{user?.name}</Text>
          <Text variant="caption" tone="muted" className="text-[13px]">{user?.email}</Text>
        </View>
      </Card>
      <Eyebrow>SESSION AND DATA</Eyebrow>
      <Card className="overflow-hidden">
        <SettingRow title="Sync status" detail={syncLabel(status, Date.now())} divider action={null} />
        <SettingRow title="Sign out" detail="Removes this device's copy of your data" action={<Button label="Sign out" variant="secondary" size="small" onPress={requestSignOut} />} />
      </Card>
      <Sheet visible={confirming} onClose={() => setConfirming(false)} title="Sign out with unsynced changes?">
        <Text variant="body-small" tone="fg-soft" className="leading-[22px]">
          {unsynced} {unsynced === 1 ? 'change has' : 'changes have'} not synced yet. Signing out removes them from this device, and they will be lost.
        </Text>
        <Button label="Stay signed in" onPress={() => setConfirming(false)} />
        <Button label="Sign out anyway" variant="secondary" onPress={() => { setConfirming(false); void signOut(); }} />
      </Sheet>
    </Screen>
  );
}
