import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';
import { Avatar, Button, FieldGroup, FieldRow, Icon, Text, useThemeColors } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { FormPage } from '@/components/layout/FormPage';
import { PickerRow } from '@/components/ui/PickerRow';
import { CurrencySelect, currencyLabel } from '@/components/ui/CurrencySelect';
import { Eyebrow } from '@/components/ui/Section';
import { CURRENCIES } from '@/constants/currencies';
import { useIsDesktop } from '@/hooks/useViewport';

interface Person {
  key: number;
  name: string;
}

const MAX_MEMBERS = 50;

export default function CreateGroup() {
  const router = useRouter();
  const { user, services } = useApp();
  const colors = useThemeColors();
  const desktop = useIsDesktop();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [people, setPeople] = useState<Person[]>([{ key: 1, name: '' }, { key: 2, name: '' }]);
  const [busy, setBusy] = useState(false);
  const [nextKey, setNextKey] = useState(3);

  useEffect(() => {
    void services.getPref('currency').then((saved) => {
      if (CURRENCIES.some((c) => c.code === saved)) setCurrency(saved as string);
    });
  }, [services]);

  const others = people.map((p) => p.name.trim()).filter(Boolean);
  const ready = name.trim().length > 0 && !busy;

  const create = async () => {
    setBusy(true);
    const group = await services.actions.createGroup({
      name: name.trim(),
      currencyCode: currency,
      members: [{ name: user!.name }, ...others.map((n) => ({ name: n }))],
      meIndex: 0,
    });
    void services.engine.sync();
    router.replace({ pathname: '/group/[id]', params: { id: group.id } });
  };

  return (
    <FormPage title="New group" desktopTitle="Create group" onClose={() => router.back()} primary={{ label: 'Create group', onPress: create, disabled: !ready, loading: busy }}>
      <FieldGroup>
        <FieldRow label={desktop ? 'Group name' : 'Name'} value={name} onChangeText={setName} placeholder="Austin Trip" maxLength={80} autoCapitalize="words" />
        <CurrencySelect value={currency} onChange={setCurrency}>
          {(open, isOpen) => <PickerRow label="Currency" value={currencyLabel(currency)} onPress={open} last dropdown={desktop} expanded={isOpen} />}
        </CurrencySelect>
      </FieldGroup>
      {desktop ? (
        <Eyebrow>ADD PEOPLE</Eyebrow>
      ) : (
        <View className="gap-0.5 px-2 pt-2">
          <Text variant="section" accessibilityRole="header">Members</Text>
          <Text variant="body-small" tone="muted">The first person is you.</Text>
        </View>
      )}
      <View className="overflow-hidden rounded-card bg-card">
        <View className="min-h-row flex-row items-center gap-3 border-b border-divider px-4">
          <Avatar name={user?.name ?? 'You'} id={user?.id} />
          <Text variant="body-small" tone="muted" className="w-[84px] shrink-0">Member 1</Text>
          <Text variant="body" className="flex-1 font-semibold">{user?.name}</Text>
          <Text variant="caption" tone="muted">You</Text>
        </View>
        {people.map((person, index) => (
          <View key={person.key} className="min-h-row flex-row items-center gap-3 border-b border-divider px-4">
            <Avatar name={person.name || '?'} id={String(person.key)} />
            <Text variant="body-small" tone="muted" className="w-[84px] shrink-0" accessible={false}>Member {index + 2}</Text>
            <TextInput
              accessibilityLabel={`Member ${index + 2} name`}
              value={person.name}
              onChangeText={(text) => setPeople((all) => all.map((p) => (p.key === person.key ? { ...p, name: text } : p)))}
              placeholder="Name"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              maxLength={80}
              className="min-h-touch flex-1 text-body text-fg"
              style={{ outlineStyle: 'none' } as never}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${person.name || `member ${index + 2}`}`} hitSlop={8} onPress={() => setPeople((all) => all.filter((p) => p.key !== person.key))} className="h-11 w-11 items-center justify-center">
              <Icon icon={X} size={18} strokeWidth={2.2} tone="muted" />
            </Pressable>
          </View>
        ))}
        <Button
          label={desktop ? '+ Add another person' : 'Add person'}
          variant="ghost"
          disabled={people.length + 1 >= MAX_MEMBERS}
          icon={desktop ? undefined : <Icon icon={Plus} size={18} strokeWidth={2.4} tone="accent" />}
          onPress={() => {
            setPeople((all) => [...all, { key: nextKey, name: '' }]);
            setNextKey((k) => k + 1);
          }}
        />
      </View>
      <Text variant="caption" tone="muted" className="px-2 text-[13px] leading-[18px]">
        You can add people who don't have CommonTab yet. Invite them with a code later.
      </Text>
    </FormPage>
  );
}
