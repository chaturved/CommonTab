import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { formatCurrency } from '@commontab/core';
import { Avatar, BackButton, Card, Pill, Text } from '@commontab/ui';
import { Eyebrow } from '../../../../src/components/Section';
import { Screen } from '../../../../src/components/Screen';
import { useGroup } from '../../../../src/data';

export default function Members() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useGroup(id);
  const members = data?.group.members ?? [];
  const balanceOf = (memberId: string) => data?.summary.balances.find((b) => b.memberID === memberId)?.minorUnits ?? 0;

  return (
    <Screen wide>
      <View className="min-h-touch flex-row items-center justify-between">
        <BackButton onPress={() => router.back()} />
        <Text variant="screen-title" accessibilityRole="header">Members</Text>
        <View className="w-11" />
      </View>
      <Eyebrow>{`${members.length} ${members.length === 1 ? 'MEMBER' : 'MEMBERS'}`}</Eyebrow>
      <Card className="overflow-hidden">
        {members.map((member, i) => {
          const balance = balanceOf(member.id);
          const you = member.id === data?.group.meMemberID;
          const owner = member.id === data?.group.ownerID;
          const amount = formatCurrency(Math.abs(balance), data?.group.currencyCode ?? 'USD');
          const words = balance > 0 ? `Owed ${amount}` : balance < 0 ? `Owes ${amount}` : 'Settled up';
          return (
            <View key={member.id} accessible accessibilityLabel={`${you ? 'You' : member.name}${owner ? ', owner' : ''}, ${words}`} className={`min-h-row-tall flex-row items-center gap-3.5 px-4 py-2 ${i < members.length - 1 ? 'border-b border-divider' : ''}`}>
              <Avatar name={member.name} id={member.id} size="md" />
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-2">
                  <Text variant="body" className="font-semibold">{you ? 'You' : member.name}</Text>
                  {owner ? <Pill label="Owner" tone="neutral" /> : null}
                </View>
                <Text variant="caption" tone={balance < 0 ? 'owe' : balance > 0 ? 'accent' : 'muted'} className="text-[13px]">{words}</Text>
              </View>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
