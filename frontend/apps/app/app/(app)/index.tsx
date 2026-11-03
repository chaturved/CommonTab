import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { SyncStatus } from '@commontab/core';
import { Button, SyncChip, Text } from '@commontab/ui';
import { useApp } from '../../src/app-context';

export default function Home() {
  const { user, services, signOut } = useApp();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => {
    const refresh = async () => {
      setStatus(await services.engine.status());
      setGroups((await services.storage.listGroups()).map((g) => g.name));
    };
    void refresh();
    return services.engine.subscribe(() => void refresh());
  }, [services]);

  const chip = !status ? { kind: 'syncing' as const }
    : status.chip === 'failed' ? { kind: 'failed' as const }
    : status.chip === 'waiting' ? { kind: 'waiting' as const, count: status.waiting }
    : { kind: 'synced' as const };

  return (
    <View className="flex-1 justify-center gap-3 bg-background p-4">
      <Text variant="screen-title">{user?.name}</Text>
      <SyncChip state={chip} />
      <Text>{groups.length === 0 ? 'No groups yet' : groups.join(', ')}</Text>
      <Button label="Add test group" onPress={() => services.actions.createGroup({ name: `Test ${groups.length + 1}`, currencyCode: 'USD', members: [{ name: user?.name ?? 'Me' }], meIndex: 0 }).then(() => services.engine.sync())} />
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </View>
  );
}
