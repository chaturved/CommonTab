import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { expensesToCsv } from '@commontab/core';
import { BackButton, Button, Card, Icon, ListRow, SegmentedControl, Sheet, Text, setAppearance, useAppearance, type AppearanceMode } from '@commontab/ui';
import { useApp } from '../../src/app-context';
import { Eyebrow } from '../../src/components/Section';
import { Screen } from '../../src/components/Screen';
import { CURRENCIES } from '../../src/currencies';
import { useGroups } from '../../src/data';
import { deliverCsv } from '../../src/exportFile';
import { useSyncStatus } from '../../src/useSyncStatus';

export default function Settings() {
  const router = useRouter();
  const { services, resetLocalData } = useApp();
  const { groups } = useGroups();
  const status = useSyncStatus();
  const appearance = useAppearance();
  const [currency, setCurrency] = useState<string>('USD');
  const [picking, setPicking] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [busy, setBusy] = useState(false);
  const unsynced = (status?.waiting ?? 0) + (status?.failed ?? 0) + (status?.conflicts ?? 0);

  useEffect(() => {
    void services.getPref('currency').then((saved) => saved && setCurrency(saved));
  }, [services]);

  const chooseAppearance = (mode: AppearanceMode) => {
    setAppearance(mode);
    void services.setPref('appearance', mode);
  };

  const chooseCurrency = (code: string) => {
    setCurrency(code);
    setPicking(false);
    void services.setPref('currency', code);
  };

  const exportCsv = () => deliverCsv(expensesToCsv(groups.map((g) => ({ group: g.group, expenses: g.expenses, settlements: g.settlements }))), 'commontab-export.csv');

  const clearData = async () => {
    setBusy(true);
    await resetLocalData();
    setBusy(false);
    setClearing(false);
  };

  return (
    <Screen wide>
      <View className="min-h-touch w-full max-w-[560px] flex-row items-center justify-between self-center">
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/account'))} />
        <Text variant="screen-title" accessibilityRole="header">Settings</Text>
        <View className="w-11" />
      </View>
      <View className="w-full max-w-[560px] gap-4 self-center">
        <Eyebrow>GENERAL</Eyebrow>
        <Card className="gap-3 p-4">
          <Text variant="body" className="font-semibold">Appearance</Text>
          <SegmentedControl
            options={[{ key: 'system', label: 'System' }, { key: 'light', label: 'Light' }, { key: 'dark', label: 'Dark' }]}
            value={appearance}
            onChange={(key) => chooseAppearance(key as AppearanceMode)}
          />
        </Card>
        <Card className="overflow-hidden">
          <Pressable accessibilityRole="button" accessibilityLabel={`Default currency, ${currency}`} onPress={() => setPicking(true)} className="min-h-row-tall flex-row items-center gap-3 px-4 py-3 active:opacity-80">
            <View className="flex-1">
              <Text variant="body" className="font-semibold">Default currency</Text>
              <Text variant="caption" tone="muted" className="text-[13px]">Used for new groups</Text>
            </View>
            <Text variant="body-small" tone="muted">{currency}</Text>
            <Icon icon={ChevronRight} size={16} strokeWidth={2.2} tone="muted" />
          </Pressable>
        </Card>

        <Eyebrow>YOUR DATA</Eyebrow>
        <Card className="overflow-hidden">
          <ListRow title="Export as CSV" subtitle="Your groups, expenses and payments" divider onPress={exportCsv} accessibilityLabel="Export as CSV" />
          <ListRow title="Clear data on this device" subtitle="Downloads everything again from your account" onPress={() => setClearing(true)} accessibilityLabel="Clear data on this device" />
        </Card>
        <Text variant="body-small" tone="muted" className="px-1 text-[13px] leading-[18px]">
          This removes the local copy only. Your groups and expenses stay in your account and download again. Changes not yet synced would be lost, so CommonTab asks first.
        </Text>
        <Text variant="caption" tone="muted" className="pt-2 text-center">CommonTab {Constants.expoConfig?.version ?? ''}</Text>
      </View>

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Default currency">
        <View className="overflow-hidden rounded-2xl bg-background">
          {CURRENCIES.map((c, i) => (
            <ListRow key={c.code} title={`${c.code} · ${c.name}`} divider={i < CURRENCIES.length - 1} accessibilityLabel={`${c.code} ${c.name}${c.code === currency ? ', selected' : ''}`} onPress={() => chooseCurrency(c.code)} />
          ))}
        </View>
      </Sheet>
      <Sheet visible={clearing} onClose={() => setClearing(false)} title={unsynced > 0 ? 'Clear data with unsynced changes?' : 'Clear data on this device?'}>
        <Text variant="body-small" tone="fg-soft" className="leading-[22px]">
          {unsynced > 0
            ? `${unsynced} ${unsynced === 1 ? 'change has' : 'changes have'} not synced yet and will be lost. Everything else downloads again from your account.`
            : 'Everything downloads again from your account. You stay signed in.'}
        </Text>
        <Button label="Keep my data" onPress={() => setClearing(false)} />
        <Button label={unsynced > 0 ? 'Clear anyway' : 'Clear data'} variant="secondary" loading={busy} onPress={clearData} />
      </Sheet>
    </Screen>
  );
}
