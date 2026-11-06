import { useState } from 'react';
import { decimalOnly } from '@/lib/amountInput';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';
import { checkSettlement, directPayments, directionWith, displayName, formatCurrency, formatMinorUnits, halfOf, simplifyDebts, type Payment } from '@commontab/core';
import { Avatar, Banner, Button, FieldGroup, Hero, Icon, ListRow, Sheet, Text, useThemeColors } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { FormPage } from '@/components/layout/FormPage';
import { Dropdown } from '@/components/ui/Dropdown';
import { OptionList } from '@/components/ui/SelectField';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { useIsDesktop } from '@/hooks/useViewport';
import { useGroup } from '@/hooks/useGroups';
import type { GroupData } from '@/types/group';

const NO_BALANCES: GroupData['summary']['balances'] = [];

export default function Settle() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const colors = useThemeColors();
  const { services } = useApp();
  const { id, with: withParam } = useLocalSearchParams<{ id: string; with?: string }>();
  const { ready, data } = useGroup(id);
  const [otherId, setOtherId] = useState<string | null>(withParam ?? null);
  const [amountText, setAmountText] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [simplify, setSimplify] = useState(true);
  const [step, setStep] = useState<'choose' | 'amount'>(withParam || !desktop ? 'amount' : 'choose');
  const [chosen, setChosen] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  const group = data?.group;
  const balances = data?.summary.balances ?? NO_BALANCES;
  const others = group?.members.filter((m) => m.id !== group.meMemberID) ?? [];
  const chosenId = otherId ?? data?.summary.counterparts[0]?.memberID ?? others[0]?.id ?? null;
  const direction = group && chosenId ? directionWith(balances, group.meMemberID, chosenId) : null;
  const amount = amountText ?? (direction ? formatMinorUnits(direction.limit, group!.currencyCode) : '');
  const check = group ? checkSettlement({ amountText: amount, direction, group }) : { ok: false as const, message: '' };
  const nameOf = (memberId: string) => {
    const member = group?.members.find((m) => m.id === memberId);
    return member ? displayName(member, group!.meMemberID) : 'Someone';
  };
  const withRow = (onPress: () => void, chevron: typeof ChevronRight) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`With, ${chosenId ? nameOf(chosenId) : 'nobody'}`} onPress={onPress} className="min-h-row flex-row items-center gap-3 border-b border-divider px-4 active:opacity-80">
      <Text variant="body-small" tone="muted" className="w-[84px] shrink-0">With</Text>
      <Text variant="body" className="flex-1">{chosenId ? nameOf(chosenId) : 'Pick someone'}</Text>
      <Icon icon={chevron} size={16} strokeWidth={2.2} tone="muted" />
    </Pressable>
  );
  const realName = (memberId: string) => group?.members.find((m) => m.id === memberId)?.name ?? '?';

  const payments: Payment[] = !data ? [] : simplify ? simplifyDebts(balances).map((t) => ({ fromID: t.fromID, toID: t.toID, minorUnits: t.minorUnits })) : directPayments({ members: data.group.members.map((m) => m.id), expenses: data.expenses, settlements: data.settlements });
  const involvesMe = (p: Payment) => group !== undefined && (p.fromID === group.meMemberID || p.toID === group.meMemberID);
  const phrase = (p: Payment) => {
    const from = nameOf(p.fromID);
    const to = nameOf(p.toID);
    return `${from} ${from === 'You' ? 'pay' : 'pays'} ${to === 'You' ? 'you' : to}`;
  };
  const choose = () => {
    const payment = payments[chosen];
    if (!payment || !involvesMe(payment) || !group) return;
    setOtherId(payment.fromID === group.meMemberID ? payment.toID : payment.fromID);
    setAmountText(null);
    setStep('amount');
  };

  const record = async () => {
    if (!group || !direction || !check.ok) return;
    setBusy(true);
    setProblem(null);
    try {
      await services.actions.addSettlement(group.id, { fromID: direction.fromID, toID: direction.toID, amountMinor: check.amountMinor });
      void services.engine.sync();
      router.replace({ pathname: '/group/[id]', params: { id: group.id } });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not record this payment.');
      setBusy(false);
    }
  };

  return (
    <FormPage
      title="Settle up"
      leading="back"
      onClose={() => router.back()}
      primary={data ? (step === 'choose' ? { label: 'Record a payment', onPress: choose, disabled: !payments[chosen] || !involvesMe(payments[chosen]!) } : { label: 'Record payment', onPress: record, disabled: !check.ok, loading: busy }) : undefined}
    >
      {data && step === 'choose' ? (
        <View className="gap-4">
          <SwitchRow title="Simplify debts" detail="Fewest payments to settle everyone" value={simplify} onChange={(next) => { setSimplify(next); setChosen(0); }} />
          <Text variant="label" tone="muted">{simplify ? 'Simplified' : 'Without simplifying'} · {payments.length} {payments.length === 1 ? 'payment' : 'payments'}</Text>
          {payments.length === 0 ? (
            <Banner tone="info" message="Everyone is even. There is nothing to settle." />
          ) : (
            <View className="overflow-hidden rounded-2xl border-[1.5px] bg-card px-4" style={{ borderColor: colors.mint }}>
              {payments.map((p, i) => {
                const mine = involvesMe(p);
                const selected = i === chosen;
                return (
                  <Pressable key={`${p.fromID}-${p.toID}`} accessibilityRole="radio" accessibilityState={{ selected, disabled: !mine }} accessibilityLabel={`${phrase(p)} ${formatCurrency(p.minorUnits, group!.currencyCode)}${mine ? '' : '. Only they can record this payment'}`} onPress={() => mine && setChosen(i)} className={`min-h-[56px] flex-row items-center gap-3 ${i < payments.length - 1 ? 'border-b border-divider' : ''} ${mine ? '' : 'opacity-60'}`}>
                    <Avatar name={realName(p.fromID)} id={p.fromID} />
                    <View className="flex-1">
                      <Text variant="body" className="font-semibold">{phrase(p)}</Text>
                      {mine ? null : <Text variant="caption" tone="muted" className="text-xs">Only they can record this one</Text>}
                    </View>
                    <Text variant="button" className={selected && mine ? 'text-accent' : ''}>{formatCurrency(p.minorUnits, group!.currencyCode)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}
      {step === 'choose' ? null : <>
      {!data ? (
        ready ? (
          <View className="items-center gap-2 px-6 py-10">
            <Text variant="section" className="text-center">Group not found</Text>
          </View>
        ) : null
      ) : (
        <View className="w-full max-w-[560px] gap-4 self-center">
          {problem ? <Banner tone="error" message={problem} /> : null}
          {direction && group ? (
            <Hero accessible accessibilityLabel={`${nameOf(direction.fromID)} pays ${nameOf(direction.toID) === 'You' ? 'you' : nameOf(direction.toID)}, ${group.name}`}>
              <View className="flex-row items-center justify-center gap-4" importantForAccessibility="no-hide-descendants">
                <Avatar name={realName(direction.fromID)} id={direction.fromID} size="md" />
                <Icon icon={ArrowRight} size={22} strokeWidth={2.2} tone="mint" />
                <Avatar name={realName(direction.toID)} id={direction.toID} size="md" />
              </View>
              <Text tone="hero-muted" className="text-center" importantForAccessibility="no-hide-descendants">
                {nameOf(direction.fromID)} {nameOf(direction.fromID) === 'You' ? 'pay' : 'pays'} {nameOf(direction.toID) === 'You' ? 'you' : nameOf(direction.toID)} · {group.name}
              </Text>
            </Hero>
          ) : (
            <Banner tone="info" message="Nobody owes anything between you and this person." />
          )}
          <View className="gap-1 rounded-card bg-card px-4 py-3">
            <Text variant="caption" tone="muted" className="text-[13px] font-bold">Amount</Text>
            <View className="flex-row items-center gap-2">
              <Text variant="large-title" tone="muted" className="text-[34px]">{formatCurrency(0, group!.currencyCode).replace(/[\d.,\s]+$/, '').trim()}</Text>
              <TextInput
                accessibilityLabel="Amount"
                value={amount}
                onChangeText={(text) => setAmountText(decimalOnly(text))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                editable={Boolean(direction)}
                className="min-h-[48px] min-w-0 flex-1 text-[34px] font-extrabold text-fg"
                style={{ outlineStyle: 'none' } as never}
              />
            </View>
          </View>
          {direction ? (
            <View className="flex-row gap-2">
              <Button label={`Full balance ${formatCurrency(direction.limit, group!.currencyCode)}`} variant="secondary" size="small" className="flex-1" onPress={() => setAmountText(formatMinorUnits(direction.limit, group!.currencyCode))} />
              <Button label={`Half ${formatCurrency(halfOf(direction.limit), group!.currencyCode)}`} variant="secondary" size="small" className="flex-1" onPress={() => setAmountText(formatMinorUnits(halfOf(direction.limit), group!.currencyCode))} />
            </View>
          ) : null}
          {amount !== '' && !check.ok ? <Text variant="caption" tone="owe" accessibilityRole="alert">{check.message}</Text> : null}
          <FieldGroup>
            {desktop ? (
              <Dropdown label="Settle up with" content={(close) => <OptionList options={others.map((m) => ({ id: m.id, label: m.name }))} selectedId={chosenId ?? undefined} onSelect={(id) => { setOtherId(id); setAmountText(null); close(); }} />}>
                {(open, isOpen) => withRow(open, isOpen ? ChevronUp : ChevronDown)}
              </Dropdown>
            ) : withRow(() => setPicking(true), ChevronRight)}
            <View accessible accessibilityLabel={direction ? `From ${nameOf(direction.fromID)}` : 'From'} className="min-h-row flex-row items-center gap-3 border-b border-divider px-4">
              <Text variant="body-small" tone="muted" className="w-[84px] shrink-0">From</Text>
              <Text variant="body" className="flex-1">{direction ? nameOf(direction.fromID) : '—'}</Text>
            </View>
            <View accessible accessibilityLabel={direction ? `To ${nameOf(direction.toID)}` : 'To'} className="min-h-row flex-row items-center gap-3 px-4">
              <Text variant="body-small" tone="muted" className="w-[84px] shrink-0">To</Text>
              <Text variant="body" className="flex-1">{direction ? nameOf(direction.toID) : '—'}</Text>
            </View>
          </FieldGroup>
          <Text variant="body-small" tone="muted" className="px-1 text-[13px] leading-[18px]">
            This records a payment that already happened. CommonTab doesn't move any money.
          </Text>
        </View>
      )}
      <Sheet visible={picking} onClose={() => setPicking(false)} title="Settle up with">
        <View className="overflow-hidden rounded-2xl bg-background">
          {others.map((m, i) => (
            <ListRow key={m.id} title={m.name} divider={i < others.length - 1} accessibilityLabel={`${m.name}${m.id === chosenId ? ', selected' : ''}`} onPress={() => { setOtherId(m.id); setAmountText(null); setPicking(false); }} />
          ))}
        </View>
      </Sheet>
      </>}
    </FormPage>
  );
}
