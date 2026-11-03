import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { sortForList } from '@commontab/core';
import { Button, Icon, SegmentedControl, Text } from '@commontab/ui';
import { ConnectionBanner } from '../../../src/components/ConnectionBanner';
import { GroupCard } from '../../../src/components/GroupCard';
import { Eyebrow } from '../../../src/components/Section';
import { Screen } from '../../../src/components/Screen';
import { useGroups } from '../../../src/data';
import { PageHeader } from '../../../src/components/PageHeader';
import { useIsDesktop } from '../../../src/layout';
import { useSyncStatus } from '../../../src/useSyncStatus';

export default function Groups() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { ready, groups } = useGroups();
  const status = useSyncStatus();
  const offline = status !== null && status.connectivity === 'offline';
  const [tab, setTab] = useState<'active' | 'settled'>('active');
  const active = sortForList(groups.map((g) => g.summary)).filter((s) => s.status !== 'settled');
  const settled = sortForList(groups.map((g) => g.summary)).filter((s) => s.status === 'settled');
  const shown = (tab === 'active' ? active : settled).map((s) => groups.find((g) => g.group.id === s.id)!);

  const open = (id: string) => router.push({ pathname: '/group/[id]', params: { id } });

  if (desktop) {
    const settledGroups = settled.map((s) => groups.find((g) => g.group.id === s.id)!);
    const activeGroups = active.map((s) => groups.find((g) => g.group.id === s.id)!);
    return (
      <Screen wide>
        <PageHeader
          title="Groups"
          subtitle={`${active.length} active, ${settled.length} settled`}
          actions={
            <>
              <Button label="Join with a code" variant="secondary" size="small" onPress={() => router.push('/join')} />
              <Button label="Create group" size="small" icon={<Icon icon={Plus} size={18} strokeWidth={2.4} tone="on-primary" />} onPress={() => router.push('/create-group')} />
            </>
          }
        />
        <ConnectionBanner />
        {ready && groups.length === 0 ? (
          <View className="items-center gap-3 px-6 py-10">
            <Text variant="section" className="text-center">No groups yet</Text>
            <Text tone="muted" className="text-center">Create a group to start splitting costs.</Text>
          </View>
        ) : null}
        {activeGroups.length > 0 ? <Eyebrow>NEEDS SETTLING</Eyebrow> : null}
        <View className="flex-row flex-wrap gap-4">
          {activeGroups.map((g) => (
            <View key={g.group.id} className="min-w-[320px] flex-1 basis-[45%]">
              <GroupCard data={g} detail offline={offline} onPress={() => open(g.group.id)} />
            </View>
          ))}
        </View>
        {settledGroups.length > 0 ? <Eyebrow>SETTLED</Eyebrow> : null}
        <View className="gap-2.5">
          {settledGroups.map((g) => (
            <GroupCard key={g.group.id} data={g} offline={offline} onPress={() => open(g.group.id)} />
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Screen wide tabs>
      <View className="min-h-touch flex-row items-center justify-between px-1">
        <Text variant="large-title" accessibilityRole="header">Groups</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Create group" onPress={() => router.push('/create-group')} className="h-11 w-11 items-center justify-center rounded-pill bg-primary active:opacity-80">
          <Icon icon={Plus} size={22} strokeWidth={2.4} tone="on-primary" />
        </Pressable>
      </View>
      <ConnectionBanner />
      <SegmentedControl
        options={[{ key: 'active', label: `Active · ${active.length}` }, { key: 'settled', label: `Settled · ${settled.length}` }]}
        value={tab}
        onChange={(key) => setTab(key as 'active' | 'settled')}
      />
      {ready && shown.length === 0 ? (
        <View className="items-center gap-3 px-6 py-10">
          <Text variant="section" className="text-center">{tab === 'active' ? 'No groups yet' : 'Nothing settled yet'}</Text>
          <Text tone="muted" className="text-center">
            {tab === 'active' ? 'Create a group to start splitting costs.' : 'Groups where everyone is even show up here.'}
          </Text>
          {tab === 'active' ? <Button label="Create a group" onPress={() => router.push('/create-group')} /> : null}
        </View>
      ) : null}
      {shown.length > 0 ? <Eyebrow>{tab === 'active' ? 'NEEDS SETTLING' : 'SETTLED'}</Eyebrow> : null}
      <View className="gap-2.5">
        {shown.map((g) => (
          <GroupCard key={g.group.id} data={g} detail offline={offline} onPress={() => open(g.group.id)} />
        ))}
      </View>
      <Button label="Have an invite code? Join a group" variant="ghost" onPress={() => router.push('/join')} />
    </Screen>
  );
}
