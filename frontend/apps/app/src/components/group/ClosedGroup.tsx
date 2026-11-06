import { useState } from 'react';
import { View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { byNewest, expenseRow, formatCurrency, longDate } from '@commontab/core';
import { Banner, Button, Card, Icon, Sheet, Text } from '@commontab/ui';
import type { GroupData } from '@/types/group';
import { useGroupActions } from '@/hooks/useGroupActions';
import { useRouter } from 'expo-router';
import { ExpenseRow } from '@/components/expense/ExpenseRow';
import { SectionHeader } from '@/components/ui/Section';

export function ClosedGroupBody({ data }: { data: GroupData }) {
  const router = useRouter();
  const { group, summary, expenses } = data;
  const actions = useGroupActions(group.id);
  const [confirming, setConfirming] = useState(false);
  const closed = summary.closed!;
  const deleted = closed.status === 'deleted';
  const currency = summary.currencyCode;
  const amount = formatCurrency(Math.abs(summary.myBalance), currency);
  const rows = expenses.filter((e) => !e.deletedAt).map((e) => expenseRow(e, group)).sort(byNewest);
  const standing = summary.myBalance < 0 ? `You owed ${amount}` : summary.myBalance > 0 ? `You were owed ${amount}` : 'You were settled up';

  const dropCopy = async () => {
    setConfirming(false);
    const outcome = await actions.deleteLocalCopy();
    if (outcome.ok) router.replace('/groups');
  };

  return (
    <View className="gap-4">
      <Card className="gap-1.5 p-5">
        <Text variant="section" accessibilityRole="header">{deleted ? 'This group was deleted' : "You're no longer in this group"}</Text>
        <Text variant="body-small" tone="fg-soft" className="leading-[22px]">
          This is a read-only copy as of {longDate(closed.since)}. New expenses from the group won't show up here, and you can't add any.
        </Text>
      </Card>
      <Card accessible accessibilityLabel={`${deleted ? 'Your balance when it was deleted' : 'Your balance when you left'}: ${standing}`} className="gap-1 p-5">
        <Text variant="label" tone="muted">{deleted ? 'Your balance when it was deleted' : 'Your balance when you left'}</Text>
        <Text variant="section" tone={summary.myBalance < 0 ? 'owe' : summary.myBalance > 0 ? 'accent' : 'fg'}>{standing}</Text>
        {summary.myBalance !== 0 ? <Text variant="caption" tone="muted" className="text-[13px]">Talk to the group owner to settle this.</Text> : null}
      </Card>
      {summary.waiting > 0 ? (
        <Banner tone="warning" icon={<Icon icon={TriangleAlert} size={20} strokeWidth={2} tone="warn-icon" />} message={`${summary.waiting} ${summary.waiting === 1 ? 'change' : 'changes'} you made offline couldn't be sent.`} />
      ) : null}
      <SectionHeader title="Expenses" />
      {rows.length === 0 ? (
        <Card className="items-center px-6 py-8"><Text tone="muted">There were no expenses.</Text></Card>
      ) : (
        <Card className="overflow-hidden">
          {rows.map((row, i) => (
            <ExpenseRow key={row.id} row={row} currencyCode={currency} subtitle="group" divider={i < rows.length - 1} />
          ))}
        </Card>
      )}
      <Button label="Delete my copy" variant="secondary" onPress={() => setConfirming(true)} />
      <Sheet visible={confirming} onClose={() => setConfirming(false)} title="Delete your copy?">
        <Text variant="body-small" tone="fg-soft" className="leading-[22px]">
          This removes {group.name} from this device. It doesn't change anything for the group.
        </Text>
        <Button label="Delete my copy" onPress={dropCopy} />
        <Button label="Keep it" variant="secondary" onPress={() => setConfirming(false)} />
      </Sheet>
    </View>
  );
}
