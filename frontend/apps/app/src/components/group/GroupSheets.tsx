import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { formatCurrency } from '@commontab/core';
import { Banner, Button, Sheet, Text } from '@commontab/ui';
import type { GroupData } from '@/types/group';
import { useGroupActions } from '@/hooks/useGroupActions';
import type { ActionResult } from '@/lib/groupErrors';

type Props = { visible: boolean; onClose: () => void; data: GroupData };

export function LeaveGroupSheet({ visible, onClose, data }: Props) {
  const router = useRouter();
  const { group, summary } = data;
  const actions = useGroupActions(group.id);
  const [result, setResult] = useState<ActionResult | null>(null);
  const blocked = summary.myBalance !== 0 || (result && !result.ok && result.blockedBalance !== undefined);
  const balance = result && !result.ok && result.blockedBalance !== undefined ? result.blockedBalance : summary.myBalance;
  const amount = formatCurrency(Math.abs(balance), summary.currencyCode);

  const close = () => {
    setResult(null);
    onClose();
  };
  const leave = async () => {
    const outcome = await actions.leave();
    setResult(outcome);
    if (outcome.ok) {
      close();
      router.replace('/groups');
    }
  };

  if (blocked) {
    return (
      <Sheet visible={visible} onClose={close} title="Settle up before leaving">
        <Text variant="body-small" tone="fg-soft" className="leading-[22px]">
          {balance > 0 ? `You're still owed ${amount}` : `You still owe ${amount}`} in {group.name}. Once everyone is even, you can leave the group.
        </Text>
        <View className="overflow-hidden rounded-2xl bg-background">
          {summary.counterparts.map((c, i) => (
            <View key={c.memberID} accessible accessibilityLabel={`${c.name} ${c.direction === 'owesMe' ? 'owes you' : 'you owe'} ${formatCurrency(c.minorUnits, summary.currencyCode)}`} className={`min-h-row flex-row items-center justify-between px-4 ${i < summary.counterparts.length - 1 ? 'border-b border-divider' : ''}`}>
              <Text variant="body" className="font-semibold">{c.direction === 'owesMe' ? `${c.name} owes you` : `You owe ${c.name}`}</Text>
              <Text variant="button" tone={c.direction === 'owesMe' ? 'accent' : 'owe'}>{formatCurrency(c.minorUnits, summary.currencyCode)}</Text>
            </View>
          ))}
        </View>
        <Button label="Go to settle up" onPress={() => { close(); router.push({ pathname: '/groups/[id]/settle', params: { id: group.id } }); }} />
        <Button label="Cancel" variant="ghost" onPress={close} />
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={close} title={`Leave ${group.name}?`}>
      <Text variant="body-small" tone="fg-soft" className="leading-[22px]">
        You'll keep a read-only copy of {group.name} on this device, and you won't see new expenses. The others stay in the group.
      </Text>
      {result && !result.ok ? <Banner tone="error" message={result.message} /> : null}
      <Button label="Leave group" loading={actions.busy} onPress={leave} />
      <Button label="Stay in group" variant="secondary" onPress={close} />
    </Sheet>
  );
}

export function DeleteGroupSheet({ visible, onClose, data }: Props) {
  const router = useRouter();
  const { group, summary } = data;
  const actions = useGroupActions(group.id);
  const [result, setResult] = useState<ActionResult | null>(null);
  const unsettled = summary.status === 'needsSettling';

  const close = () => {
    setResult(null);
    onClose();
  };
  const remove = async () => {
    const outcome = await actions.deleteGroup();
    setResult(outcome);
    if (outcome.ok) {
      close();
      router.replace('/groups');
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title={`Delete ${group.name}?`}>
      <Text variant="body-small" tone="fg-soft" className="leading-[22px]">
        {unsettled
          ? 'Everyone needs to be settled up before a group can be deleted.'
          : 'Everyone is told the group was deleted and keeps a read-only copy of what was in it. This can\'t be undone.'}
      </Text>
      {result && !result.ok ? <Banner tone="error" message={result.message} /> : null}
      {unsettled ? null : <Button label="Delete group" loading={actions.busy} onPress={remove} />}
      <Button label={unsettled ? 'OK' : 'Keep group'} variant="secondary" onPress={close} />
    </Sheet>
  );
}

export function RemoveMemberSheet({ visible, onClose, data, memberId }: Props & { memberId: string | null }) {
  const { group, summary } = data;
  const actions = useGroupActions(group.id);
  const [result, setResult] = useState<ActionResult | null>(null);
  const member = group.members.find((m) => m.id === memberId);
  const owed = summary.balances.find((b) => b.memberID === memberId)?.minorUnits ?? 0;

  const close = () => {
    setResult(null);
    onClose();
  };
  const remove = async () => {
    if (!memberId) return;
    const outcome = await actions.removeMember(memberId);
    setResult(outcome);
    if (outcome.ok) close();
  };

  return (
    <Sheet visible={visible} onClose={close} title={`Remove ${member?.name ?? 'this person'}?`}>
      <Text variant="body-small" tone="fg-soft" className="leading-[22px]">
        {member?.name} won't be able to add expenses any more{member?.userID ? ' and keeps a read-only copy' : ''}.
        {owed === 0 ? '' : ` ${owed < 0 ? `They still owe ${formatCurrency(-owed, summary.currencyCode)}` : `They are still owed ${formatCurrency(owed, summary.currencyCode)}`}; that stays in the group's balances.`}
      </Text>
      {result && !result.ok ? <Banner tone="error" message={result.message} /> : null}
      <Button label="Remove" loading={actions.busy} onPress={remove} />
      <Button label="Cancel" variant="secondary" onPress={close} />
    </Sheet>
  );
}
