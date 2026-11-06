import { ReactNode } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { Activity, CircleUser, House, Plus, Users } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { sortForList } from '@commontab/core';
import { Avatar, Icon, Text, useThemeColors } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { useGroups } from '@/hooks/useGroups';
import { syncLabel } from '@/lib/syncLabel';
import { useNow } from '@/hooks/useNow';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { Wordmark } from '@/components/ui/Logo';

const NAV = [
  { label: 'Home', icon: House, href: '/home', match: (p: string) => p === '/home' },
  { label: 'Groups', icon: Users, href: '/groups', match: (p: string) => p === '/groups' || p.startsWith('/groups/') || p === '/groups/new' },
  { label: 'Activity', icon: Activity, href: '/activity', match: (p: string) => p === '/activity' },
  { label: 'Account', icon: CircleUser, href: '/account', match: (p: string) => p === '/account' },
] as const;

export function DesktopShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const colors = useThemeColors();
  const { user } = useApp();
  const { groups } = useGroups();
  const status = useSyncStatus();
  const now = useNow();
  const ordered = sortForList(groups.map((g) => g.summary).filter((s) => s.active));
  const activeGroup = path.startsWith('/groups/') ? path.split('/')[2] : null;
  const dot = (balance: number, settled: boolean) => (settled || balance === 0 ? colors.muted : balance > 0 ? colors.accent : colors.owe);

  return (
    <View className="flex-1 flex-row bg-background">
      <View accessibilityRole="navigation" accessibilityLabel="Main" className="w-[248px] shrink-0 gap-1.5 border-r border-divider bg-card px-4 py-[22px]">
        <View className="px-2 pb-[18px]"><Wordmark /></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Add expense" onPress={() => router.push('/expenses/new')} className="mb-3.5 h-11 flex-row items-center justify-center gap-1.5 rounded-pill bg-primary active:opacity-80">
          <Icon icon={Plus} size={18} strokeWidth={2.4} tone="on-primary" />
          <Text variant="button" tone="on-primary" className="text-[15px]">Add expense</Text>
        </Pressable>
        {NAV.map((item) => {
          const selected = item.match(path);
          return (
            <Pressable key={item.label} accessibilityRole="link" accessibilityLabel={item.label} accessibilityState={{ selected }} onPress={() => router.navigate(item.href)} className={`h-10 flex-row items-center gap-3 rounded-xl px-3 ${selected ? 'bg-tint-selected' : 'active:opacity-80'}`}>
              <Icon icon={item.icon} size={20} strokeWidth={1.9} tone={selected ? 'accent' : 'tab'} />
              <Text variant="body-small" tone={selected ? 'accent' : 'tab'} className={selected ? 'font-bold' : 'font-semibold'}>{item.label}</Text>
            </Pressable>
          );
        })}
        <Text variant="caption" tone="muted" className="px-3 pb-1.5 pt-5 text-xs font-bold tracking-wider">Groups</Text>
        {ordered.length === 0 ? (
          <View className="gap-1 px-3">
            <Text variant="body-small" tone="muted" className="text-sm leading-5">No groups yet.</Text>
            <Pressable accessibilityRole="link" accessibilityLabel="Create a group" onPress={() => router.push('/groups/new')} className="min-h-touch justify-center active:opacity-80">
              <Text variant="body-small" tone="accent" className="text-sm font-bold">+ Create a group</Text>
            </Pressable>
          </View>
        ) : null}
        <View className="gap-0.5">
          {ordered.map((s) => {
            const selected = s.id === activeGroup;
            return (
              <Pressable key={s.id} accessibilityRole="link" accessibilityLabel={s.name} accessibilityState={{ selected }} onPress={() => router.navigate({ pathname: '/groups/[id]', params: { id: s.id } })} className={`h-9 flex-row items-center gap-2.5 rounded-[10px] px-3 ${selected ? 'bg-background' : 'active:opacity-80'}`}>
                <View className="h-2 w-2 rounded-pill" style={{ backgroundColor: dot(s.myBalance, s.status === 'settled') }} />
                <Text variant="body-small" tone={selected ? 'fg' : 'tab'} numberOfLines={1} className={`flex-1 text-sm ${selected ? 'font-bold' : 'font-medium'}`}>{s.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <View className="mt-auto flex-row items-center gap-2.5 rounded-[14px] bg-tint px-3 py-2.5" accessible accessibilityLabel={`${user?.name}. ${syncLabel(status, now)}`}>
          <Avatar name={user?.name ?? '?'} id={user?.id} size="md" className="h-[34px] w-[34px]" />
          <View className="min-w-0 flex-1">
            <Text variant="body-small" numberOfLines={1} className="text-sm font-bold">{user?.name}</Text>
            <Text variant="caption" tone="on-tint" className="text-xs font-semibold">{syncLabel(status, now)}</Text>
          </View>
        </View>
      </View>
      <View className="min-w-0 flex-1">{children}</View>
    </View>
  );
}
