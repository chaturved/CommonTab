import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { BackButton, Text } from '@commontab/ui';
import { MembersList } from '../../../../src/components/GroupParts';
import { Eyebrow } from '../../../../src/components/Section';
import { Screen } from '../../../../src/components/Screen';
import { useGroup } from '../../../../src/data';

export default function Members() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useGroup(id);
  const members = data?.group.members ?? [];

  return (
    <Screen wide>
      <View className="min-h-touch flex-row items-center justify-between">
        <BackButton onPress={() => router.back()} />
        <Text variant="screen-title" accessibilityRole="header">Members</Text>
        <View className="w-11" />
      </View>
      <Eyebrow>{`${members.length} ${members.length === 1 ? 'MEMBER' : 'MEMBERS'}`}</Eyebrow>
      {data ? <MembersList data={data} /> : null}
    </Screen>
  );
}
