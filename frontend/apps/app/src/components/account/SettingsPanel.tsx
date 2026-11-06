import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { Pressable, View } from 'react-native';
import { expensesToCsv } from '@commontab/core';
import { Button, Card, ListRow, SegmentedControl, Sheet, Text, setAppearance, useAppearance, type AppearanceMode } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { CurrencySelect } from '@/components/ui/CurrencySelect';
import { useGroups } from '@/hooks/useGroups';
import { deliverCsv } from '@/lib/exportFile';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { Eyebrow } from '@/components/ui/Section';

export function SettingsPanel({ showVersion }: { showVersion?: boolean }) {
  const { services, resetLocalData } = useApp();
  const { groups } = useGroups();
  const status = useSyncStatus();
  const appearance = useAppearance();
  const [currency, setCurrency] = useState<string>('USD');
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
    <View className="gap-4">
      <Eyebrow>GENERAL</Eyebrow>
      <Card className="gap-3 p-4">
        <Text variant="body" className="font-semibold">Appearance</Text>
        <SegmentedControl
          options={[{ key: 'system', label: 'System' }, { key: 'light', label: 'Light' }, { key: 'dark', label: 'Dark' }]}
          value={appearance}
          onChange={(key) => chooseAppearance(key as AppearanceMode)}
        />
      </Card>
      <CurrencySelect value={currency} onChange={chooseCurrency}>
        {(open) => (
          <Card className="overflow-hidden">
            <Pressable accessibilityRole="button" accessibilityLabel={`Default currency, ${currency}`} onPress={open} className="min-h-row-tall flex-row items-center gap-3 px-4 py-3 active:opacity-80">
              <View className="flex-1">
                <Text variant="body" className="font-semibold">Default currency</Text>
                <Text variant="caption" tone="muted" className="text-[13px]">Used for new groups</Text>
              </View>
              <Text variant="body-small" tone="muted">{currency} ▾</Text>
            </Pressable>
          </Card>
        )}
      </CurrencySelect>

      <Eyebrow>YOUR DATA</Eyebrow>
      <Card className="overflow-hidden">
        <ListRow title="Export as CSV" subtitle="Your groups, expenses and payments" divider onPress={exportCsv} accessibilityLabel="Export as CSV" />
        <ListRow title="Clear data on this device" subtitle="Downloads everything again from your account" onPress={() => setClearing(true)} accessibilityLabel="Clear data on this device" />
      </Card>
      <Text variant="body-small" tone="muted" className="px-1 text-[13px] leading-[18px]">
        This removes the local copy only. Your groups and expenses stay in your account and download again. Changes not yet synced would be lost, so CommonTab asks first.
      </Text>
      {showVersion ? <Text variant="caption" tone="muted" className="pt-2 text-center">CommonTab {Constants.expoConfig?.version ?? ''}</Text> : null}

      <Sheet visible={clearing} onClose={() => setClearing(false)} title={unsynced > 0 ? 'Clear data with unsynced changes?' : 'Clear data on this device?'}>
        <Text variant="body-small" tone="fg-soft" className="leading-[22px]">
          {unsynced > 0
            ? `${unsynced} ${unsynced === 1 ? 'change has' : 'changes have'} not synced yet and will be lost. Everything else downloads again from your account.`
            : 'Everything downloads again from your account. You stay signed in.'}
        </Text>
        <Button label="Keep my data" onPress={() => setClearing(false)} />
        <Button label={unsynced > 0 ? 'Clear anyway' : 'Clear data'} variant="secondary" loading={busy} onPress={clearData} />
      </Sheet>
    </View>
  );
}
