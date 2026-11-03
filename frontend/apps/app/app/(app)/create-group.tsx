import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ChevronRight, Plus, X } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';
import { Avatar, Button, FieldGroup, FieldRow, Icon, ListRow, Sheet, Text, useThemeColors } from '@commontab/ui';
import { useApp } from '../../src/app-context';
import { Screen } from '../../src/components/Screen';
import { CURRENCIES } from '../../src/currencies';

interface Person {
  key: number;
  name: string;
}

const MAX_MEMBERS = 50;

export default function CreateGroup() {
  const router = useRouter();
  const { user, services } = useApp();
  const colors = useThemeColors();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>(CURRENCIES[0]);
  const [picking, setPicking] = useState(false);
  const [people, setPeople] = useState<Person[]>([{ key: 1, name: '' }, { key: 2, name: '' }]);
  const [busy, setBusy] = useState(false);
  const [nextKey, setNextKey] = useState(3);

  const others = people.map((p) => p.name.trim()).filter(Boolean);
  const ready = name.trim().length > 0 && !busy;

  const create = async () => {
    setBusy(true);
    const group = await services.actions.createGroup({
      name: name.trim(),
      currencyCode: currency.code,
      members: [{ name: user!.name }, ...others.map((n) => ({ name: n }))],
      meIndex: 0,
    });
    void services.engine.sync();
    router.replace({ pathname: '/group/[id]', params: { id: group.id } });
  };

  return (
    <Screen footer={<Button label="Create group" loading={busy} disabled={!ready} onPress={create} />}>
      <View className="min-h-touch flex-row items-center justify-between">
        <Button label="Cancel" variant="ghost" size="small" onPress={() => router.back()} />
        <Text variant="screen-title" accessibilityRole="header">New group</Text>
        <View className="w-[72px]" />
      </View>
      <FieldGroup>
        <FieldRow label="Name" value={name} onChangeText={setName} placeholder="Austin Trip" maxLength={80} autoCapitalize="words" />
        <Pressable accessibilityRole="button" accessibilityLabel={`Currency, ${currency.code} ${currency.name}`} onPress={() => setPicking(true)} className="min-h-row flex-row items-center gap-3 px-4 active:opacity-80">
          <Text variant="body-small" tone="muted" className="w-[84px] shrink-0">Currency</Text>
          <Text variant="body" className="flex-1">{currency.code} · {currency.name}</Text>
          <Icon icon={ChevronRight} size={16} strokeWidth={2.2} tone="muted" />
        </Pressable>
      </FieldGroup>
      <View className="gap-0.5 px-2 pt-2">
        <Text variant="section" accessibilityRole="header">Members</Text>
        <Text variant="body-small" tone="muted">The first person is you.</Text>
      </View>
      <FieldGroup>
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
          label="Add person"
          variant="ghost"
          disabled={people.length + 1 >= MAX_MEMBERS}
          icon={<Icon icon={Plus} size={18} strokeWidth={2.4} tone="accent" />}
          onPress={() => {
            setPeople((all) => [...all, { key: nextKey, name: '' }]);
            setNextKey((k) => k + 1);
          }}
        />
      </FieldGroup>
      <Text variant="caption" tone="muted" className="px-2 text-[13px] leading-[18px]">
        You can add people who don't have CommonTab yet. Invite them with a code later.
      </Text>
      <Sheet visible={picking} onClose={() => setPicking(false)} title="Currency">
        <View className="overflow-hidden rounded-2xl bg-background">
          {CURRENCIES.map((c, i) => (
            <ListRow
              key={c.code}
              title={`${c.code} · ${c.name}`}
              divider={i < CURRENCIES.length - 1}
              accessibilityLabel={`${c.code} ${c.name}${c.code === currency.code ? ', selected' : ''}`}
              onPress={() => {
                setCurrency(c);
                setPicking(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
