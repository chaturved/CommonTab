import { Tabs, useRouter } from 'expo-router';
import { Activity, CircleUser, House, Users } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar } from '@commontab/ui';

const TABS = [
  { key: 'index', label: 'Home', icon: House, href: '/' },
  { key: 'groups', label: 'Groups', icon: Users, href: '/groups' },
  { key: 'activity', label: 'Activity', icon: Activity, href: '/activity' },
  { key: 'account', label: 'Account', icon: CircleUser, href: '/account' },
] as const;

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state }) => (
        <View pointerEvents="box-none" className="absolute inset-x-0 bottom-0 items-center px-4" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <View className="w-full max-w-[480px]">
            <TabBar
              tabs={TABS}
              activeKey={state.routes[state.index]?.name ?? 'index'}
              onSelect={(key) => router.navigate(TABS.find((t) => t.key === key)!.href)}
              onAdd={() => router.push('/add-expense')}
            />
          </View>
        </View>
      )}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.key} name={tab.key} />
      ))}
    </Tabs>
  );
}
