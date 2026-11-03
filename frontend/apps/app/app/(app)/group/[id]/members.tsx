import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { UserPlus } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { BackButton, Icon, Text } from '@commontab/ui';
import { MembersList } from '../../../../src/components/GroupParts';
import { Eyebrow } from '../../../../src/components/Section';
import { Screen } from '../../../../src/components/Screen';
import { useGroup } from '../../../../src/data';
import { useIsDesktop } from '../../../../src/layout';

export default function Members() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useGroup(id);
  const desktop = useIsDesktop();
  if (desktop) return <Redirect href={{ pathname: '/group/[id]', params: { id, tab: 'Members' } }} />;
  const members = data?.group.members ?? [];

  return (
    <Screen wide>
      <View className="min-h-touch flex-row items-center justify-between">
        <BackButton onPress={() => router.back()} />
        <Text variant="screen-title" accessibilityRole="header">Members</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Invite people" onPress={() => router.push({ pathname: '/group/[id]/invite', params: { id } })} className="h-11 w-11 items-center justify-center rounded-pill bg-card active:opacity-80">
          <Icon icon={UserPlus} size={20} strokeWidth={2} tone="accent" />
        </Pressable>
      </View>
      <Eyebrow>{`${members.length} ${members.length === 1 ? 'MEMBER' : 'MEMBERS'}`}</Eyebrow>
      {data ? <MembersList data={data} /> : null}
    </Screen>
  );
}
