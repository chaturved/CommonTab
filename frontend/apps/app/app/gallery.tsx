import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Activity, CircleUser, House, Plus, Users } from 'lucide-react-native';
import {
  AmountText, AvatarStack, Banner, Button, Card, Hero, Icon, ListRow, Pill, Sheet, SyncChip, TabBar, Text,
} from '@commontab/ui';

const TABS = [
  { key: 'home', label: 'Home', icon: House },
  { key: 'groups', label: 'Groups', icon: Users },
  { key: 'activity', label: 'Activity', icon: Activity },
  { key: 'account', label: 'Account', icon: CircleUser },
];

const people = (names: string[]) => names.map((name) => ({ id: name, name }));

/** Every base component in one place, for visual checks in light, dark and large text. Not shipped in the product navigation. */
export default function Gallery() {
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(false);
  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="pb-32">
        <View className="flex-row items-center justify-between px-5 pt-4">
          <Text variant="large-title">CommonTab</Text>
          <SyncChip state={{ kind: 'synced' }} />
        </View>

        <Banner className="mx-4 mt-3" title="You're offline." message="Changes are saved on this phone and sync when you're back." />

        <Hero className="mx-4 mt-3">
          <View className="gap-1">
            <Text variant="label" tone="mint" className="text-[12px]">You're owed overall</Text>
            <Text variant="balance" tone="white" accessibilityLabel="You're owed $97.00 overall">$97.00</Text>
          </View>
          <View className="flex-row gap-2.5">
            {[['You owe', '$12.00'], ['Owed to you', '$109.00']].map(([label, value]) => (
              <View key={label} className="flex-1 gap-0.5 rounded-2xl bg-white/10 px-3 py-2.5">
                <Text variant="caption" tone="hero-muted">{label}</Text>
                <Text variant="button" tone="white" className="text-[17px]">{value}</Text>
              </View>
            ))}
          </View>
          <View className="flex-row gap-2.5">
            <Button variant="hero" size="small" label="Add expense" className="flex-[1.4]" icon={<Icon icon={Plus} size={18} strokeWidth={2.4} tone="hero-to" />} />
            <Button variant="hero-outline" size="small" label="Settle up" className="flex-1" />
          </View>
        </Hero>

        <View className="flex-row items-center justify-between px-5 pt-6">
          <Text variant="section">Groups</Text>
          <Button variant="ghost" label="Create group" icon={<Icon icon={Plus} size={16} strokeWidth={2.4} tone="accent" />} />
        </View>
        <View className="gap-2.5 px-4 pt-1">
          {[
            { name: 'Austin Trip', members: ['Chaturved L', 'Sam M', 'Riya K'], units: 10900 },
            { name: 'Apartment', members: ['Chaturved L', 'Sam M', 'Jordan T'], units: -1200 },
            { name: 'Weekend Ski', members: ['Chaturved L', 'Sam M'], units: 0 },
          ].map((group) => (
            <Card key={group.name}>
              <ListRow
                tall
                title={group.name}
                subtitle={`${group.members.length} members`}
                leading={<AvatarStack members={people(group.members)} className="w-20" />}
                trailing={<AmountText minorUnits={group.units} currency="USD" />}
                accessibilityLabel={`${group.name}, ${group.members.length} members`}
                onPress={() => {}}
                chevron={false}
              />
            </Card>
          ))}
        </View>

        <Text variant="label" tone="muted" className="px-5 pt-6">Sync states</Text>
        <View className="flex-row flex-wrap gap-2 px-4 pt-2">
          <SyncChip state={{ kind: 'synced' }} />
          <SyncChip state={{ kind: 'syncing' }} />
          <SyncChip state={{ kind: 'waiting', count: 3 }} onPress={() => {}} />
          <SyncChip state={{ kind: 'failed' }} onPress={() => {}} />
        </View>

        <Text variant="label" tone="muted" className="px-5 pt-6">Banners and pills</Text>
        <View className="gap-2.5 px-4 pt-2">
          <Banner tone="error" title="Server is down." message="Your changes are safe and will sync automatically." />
          <Banner tone="info" message="Sam joined Austin Trip." />
          <View className="flex-row flex-wrap gap-2">
            <Pill label="3 members" tone="neutral" />
            <Pill label="Settled" tone="accent" />
            <Pill label="Waiting" tone="warn" />
            <Pill label="You owe" tone="owe" />
          </View>
        </View>

        <Text variant="label" tone="muted" className="px-5 pt-6">Buttons</Text>
        <View className="gap-2.5 px-4 pt-2">
          <Button label="Got it" />
          <Button label="Restore my version" variant="secondary" size="small" />
          <Button label="Saving…" loading />
          <Button label="Open sheet" variant="secondary" size="small" onPress={() => setSheet(true)} />
        </View>
      </ScrollView>

      <TabBar className="absolute bottom-5 left-4 right-4" tabs={TABS} activeKey={tab} onSelect={setTab} onAdd={() => {}} />

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Session expired">
        <Text variant="body-small" tone="muted">Sign in again to keep syncing. Your changes are still on this phone.</Text>
        <Button label="Sign in" onPress={() => setSheet(false)} />
      </Sheet>
    </View>
  );
}
