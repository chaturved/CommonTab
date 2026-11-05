import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Avatar, Button, Card, Sheet, Text } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Eyebrow } from '@/components/ui/Section';
import { Screen } from '@/components/layout/Screen';
import { SettingsPanel } from '@/components/account/SettingsPanel';
import { ChangeNameSheet, ChangePasswordSheet, DeleteAccountSheet } from '@/components/account/AccountSheets';
import { useIsDesktop } from '@/hooks/useViewport';
import { syncLabel } from '@/lib/syncLabel';
import { useSyncStatus } from '@/hooks/useSyncStatus';

function SettingRow({ title, detail, label, onPress, divider, desktop, danger }: { title: string; detail: string; label?: string; onPress?: () => void; divider?: boolean; desktop?: boolean; danger?: boolean }) {
  return (
    <View className={`min-h-row-tall flex-row items-center gap-3.5 px-4 py-3 ${desktop ? 'px-5' : ''} ${divider ? 'border-b border-divider' : ''}`}>
      <View className="flex-1">
        <Text variant="body" className="font-semibold">{title}</Text>
        <Text variant="caption" tone="muted" className="text-[13px]">{detail}</Text>
      </View>
      {label && onPress ? (
        desktop ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${title}`} onPress={onPress} hitSlop={8} className="min-h-touch justify-center active:opacity-80">
            <Text variant="body-small" tone={danger ? 'owe' : 'accent'} className="text-sm font-bold">{label}</Text>
          </Pressable>
        ) : (
          <Button label={label} variant="secondary" size="small" accessibilityLabel={`${label}: ${title}`} onPress={onPress} className={danger ? 'border-owe' : ''} />
        )
      ) : null}
    </View>
  );
}

export default function Account() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { user, signOut } = useApp();
  const status = useSyncStatus();
  const [confirming, setConfirming] = useState(false);
  const [dialog, setDialog] = useState<'name' | 'password' | 'delete' | null>(null);
  const unsynced = (status?.waiting ?? 0) + (status?.failed ?? 0) + (status?.conflicts ?? 0);
  const requestSignOut = () => (unsynced > 0 ? setConfirming(true) : void signOut());

  const profile = desktop ? (
    <Card className="flex-row items-center gap-4 p-6">
      <Avatar name={user?.name ?? '?'} id={user?.id} size="md" className="h-16 w-16" />
      <View>
        <Text variant="section" className="text-[22px] font-extrabold leading-7">{user?.name}</Text>
        <Text variant="body-small" tone="muted" className="text-sm">{user?.email}</Text>
      </View>
    </Card>
  ) : (
    <Card className="min-h-row-tall flex-row items-center gap-3.5 px-4 py-3">
      <Avatar name={user?.name ?? '?'} id={user?.id} size="md" />
      <View className="flex-1">
        <Text variant="body" className="font-semibold">{user?.name}</Text>
        <Text variant="caption" tone="muted" className="text-[13px]">{user?.email}</Text>
      </View>
    </Card>
  );

  const profileRows = (
    <>
      <Eyebrow>PROFILE</Eyebrow>
      <Card className="overflow-hidden">
        <SettingRow desktop={desktop} title="Change name" detail={user?.name ?? ''} label="Edit" onPress={() => setDialog('name')} divider />
        <SettingRow desktop={desktop} title="Change password" detail="Other devices are signed out" label="Change" onPress={() => setDialog('password')} />
      </Card>
    </>
  );

  const session = (
    <>
      <Eyebrow>SESSION AND DATA</Eyebrow>
      <Card className="overflow-hidden">
        <SettingRow desktop={desktop} title="Sync status" detail={syncLabel(status, Date.now())} divider />
        <SettingRow desktop={desktop} title="Sign out" detail="Warns first if changes are unsynced" label="Sign out" onPress={requestSignOut} divider />
        <SettingRow desktop={desktop} title="Delete account" detail="Removes your data from our servers" label="Delete" onPress={() => setDialog('delete')} danger />
      </Card>
    </>
  );

  const tools = (
    <>
      <Eyebrow>TOOLS</Eyebrow>
      <Card className="overflow-hidden">
        <SettingRow desktop={desktop} title="Tip & split calculator" detail="Split a restaurant bill by person or item" label="Open" onPress={() => router.push('/calculator')} />
      </Card>
    </>
  );

  return (
    <Screen wide={desktop} tabs>
      {desktop ? (
        <PageHeader title="Account" />
      ) : (
        <View className="min-h-touch justify-center px-1">
          <Text variant="large-title" accessibilityRole="header">Account</Text>
        </View>
      )}
      {desktop ? (
        <View className="flex-row items-start gap-[22px]">
          <View className="min-w-0 flex-1 gap-4">
            {profile}
            {profileRows}
            {session}
          </View>
          <View className="min-w-0 flex-1 gap-4">
            <SettingsPanel />
            {tools}
          </View>
        </View>
      ) : (
        <>
          {profile}
          {profileRows}
          <Eyebrow>SETTINGS</Eyebrow>
          <Card className="overflow-hidden">
            <SettingRow title="Settings" detail="Appearance, currency and data" label="Open" onPress={() => router.push('/settings')} />
          </Card>
          {tools}
          {session}
        </>
      )}
      <ChangeNameSheet visible={dialog === 'name'} onClose={() => setDialog(null)} />
      <ChangePasswordSheet visible={dialog === 'password'} onClose={() => setDialog(null)} />
      <DeleteAccountSheet visible={dialog === 'delete'} onClose={() => setDialog(null)} />
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
