import { useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { UserPlus } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { BackButton, Icon, Text } from '@commontab/ui';
import { GroupActionRows } from '../../../../src/components/GroupDangerRows';
import { DeleteGroupSheet, LeaveGroupSheet, RemoveMemberSheet } from '../../../../src/components/GroupSheets';
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
  const [sheet, setSheet] = useState<'leave' | 'delete' | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const members = (data?.group.members ?? []).filter((m) => !m.removedAt);

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
      {data ? <MembersList data={data} onRemove={data.group.ownerID === data.group.meMemberID && !data.summary.closed ? setRemoving : undefined} /> : null}
      {data && !data.summary.closed ? (
        <>
          <Eyebrow>GROUP</Eyebrow>
          <GroupActionRows data={data} onLeave={() => setSheet('leave')} onDelete={() => setSheet('delete')} />
          <LeaveGroupSheet visible={sheet === 'leave'} onClose={() => setSheet(null)} data={data} />
          <DeleteGroupSheet visible={sheet === 'delete'} onClose={() => setSheet(null)} data={data} />
          <RemoveMemberSheet visible={removing !== null} onClose={() => setRemoving(null)} data={data} memberId={removing} />
        </>
      ) : null}
    </Screen>
  );
}
