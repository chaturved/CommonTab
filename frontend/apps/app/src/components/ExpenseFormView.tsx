import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import {
  addDifferenceTo, balanceChangeNote, balanceChanges, CATEGORIES, displayName, evaluateForm, evenPercents, formatCurrency,
  formFromExpense, longDate, newExpenseForm, splitIssueMessage, splitRestEqually, switchMethod, toggleParticipant, type ExpenseForm,
  type FormMethod, type LocalExpense,
} from '@commontab/core';
import { Banner, Button, CheckRow, FieldGroup, FieldRow, Icon, ListRow, SegmentedControl, Sheet, Text, useThemeColors } from '@commontab/ui';
import { useApp } from '../app-context';
import type { GroupData } from '../data';
import { useIsDesktop } from '../layout';
import { useSyncStatus } from '../useSyncStatus';

const symbolOf = (currencyCode: string) => formatCurrency(0, currencyCode).replace(/[\d.,\s]+$/, '').trim();

const dayOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const decimalOnly = (text: string) => {
  const cleaned = text.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
};

export function ExpenseFormView({ mode, data, expense, groups, onPickGroup }: {
  mode: 'add' | 'edit';
  data: GroupData;
  expense?: LocalExpense;
  groups?: GroupData[];
  onPickGroup?: (id: string) => void;
}) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const colors = useThemeColors();
  const status = useSyncStatus();
  const { services } = useApp();
  const { group } = data;
  const currency = group.currencyCode;
  const [form, setForm] = useState<ExpenseForm>(() => (expense ? formFromExpense(expense, currency) : newExpenseForm(group, Date.now())));
  const [sheet, setSheet] = useState<'payer' | 'date' | 'group' | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const evaluated = useMemo(() => evaluateForm(form, currency), [form, currency]);
  const memberIds = group.members.map((m) => m.id);
  const nameOf = (id: string) => {
    const member = group.members.find((m) => m.id === id);
    return member ? displayName(member, group.meMemberID) : 'Someone';
  };
  const offline = status !== null && status.connectivity === 'offline';
  const patch = (changes: Partial<ExpenseForm>) => setForm((f) => ({ ...f, ...changes }));
  const shareOf = (id: string) => evaluated.shares.find((s) => s.memberID === id)?.minorUnits;
  const lastParticipant = form.participants[form.participants.length - 1];

  const note = useMemo(() => {
    if (mode !== 'edit' || !expense || !evaluated.draft) return null;
    const before = { payerID: expense.payerID, amountMinor: expense.amountMinor, allocations: expense.allocations };
    const after = { payerID: evaluated.draft.payerID, amountMinor: evaluated.draft.amountMinor, allocations: evaluated.shares };
    return balanceChangeNote(balanceChanges(group, before, after), group.meMemberID, currency);
  }, [mode, expense, evaluated, group, currency]);

  const save = async () => {
    if (!evaluated.draft) return;
    setBusy(true);
    setProblem(null);
    try {
      const saved = await services.actions.saveExpense(group.id, { ...evaluated.draft, id: expense?.id });
      void services.engine.sync();
      if (mode === 'edit') router.back();
      else router.replace({ pathname: '/group/[id]', params: { id: saved.groupID } });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not save this expense.');
      setBusy(false);
    }
  };

  const issue = evaluated.split && form.method !== 'equal' ? evaluated.split : null;
  const touchedSplit = form.method !== 'equal';

  return (
    <View className={desktop ? 'w-full max-w-[560px] gap-4 self-center' : 'w-full gap-4'}>
      <View className="min-h-touch flex-row items-center justify-between">
        <Button label="Cancel" variant="ghost" size="small" onPress={() => router.back()} />
        <Text variant="screen-title" accessibilityRole="header">{mode === 'add' ? 'Add expense' : 'Edit expense'}</Text>
        <View className="w-[72px]" />
      </View>

      {mode === 'edit' && offline ? (
        <Banner tone="warning" message={`You're offline. This edit is saved on ${desktop ? 'this browser' : 'your phone'} and sent when you reconnect. If someone else changes this expense first, you'll be asked which version to keep.`} />
      ) : null}
      {problem ? <Banner tone="error" message={problem} /> : null}

      <View className="gap-1 rounded-card bg-card px-4 py-3">
        <Text variant="caption" tone="muted" className="text-[13px] font-bold">Amount</Text>
        <View className="flex-row items-center gap-2">
          <Text variant="large-title" tone="muted" className="text-[34px]">{symbolOf(currency)}</Text>
          <TextInput
            accessibilityLabel="Amount"
            value={form.amountText}
            onChangeText={(text) => patch({ amountText: decimalOnly(text) })}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            autoFocus={mode === 'add'}
            className="min-h-[48px] min-w-0 flex-1 text-[34px] font-extrabold text-fg"
            style={{ outlineStyle: 'none' } as never}
          />
        </View>
        {evaluated.errors.amount && form.amountText !== '' ? <Text variant="caption" tone="owe">{evaluated.errors.amount}</Text> : null}
      </View>

      <FieldGroup>
        <FieldRow label="Description" value={form.merchant} onChangeText={(merchant) => patch({ merchant })} placeholder="Dinner at Uchi" maxLength={120} autoCapitalize="sentences" />
        <PickerRow label="Group" value={group.name} onPress={groups && groups.length > 1 ? () => setSheet('group') : undefined} />
        <PickerRow label="Paid by" value={nameOf(form.payerID)} onPress={() => setSheet('payer')} />
        <PickerRow label="Date" value={evaluated.errors.date ? form.date : longDate(`${form.date}T12:00:00Z`)} onPress={() => setSheet('date')} />
        <FieldRow label="Notes" value={form.notes} onChangeText={(notes) => patch({ notes })} placeholder="Optional" maxLength={500} last />
      </FieldGroup>

      <View className="w-full overflow-hidden">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-0.5 py-1" accessibilityLabel="Category">
        {CATEGORIES.map((c) => {
          const selected = form.category === c.id;
          return (
            <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Category ${c.label}`} accessibilityState={{ selected }} onPress={() => patch({ category: c.id })} className={`min-h-touch justify-center rounded-pill px-4 ${selected ? 'bg-primary' : 'bg-card'}`}>
              <Text variant="body-small" tone={selected ? 'on-primary' : 'fg-soft'} className="font-semibold">{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      </View>

      <Text variant="section" accessibilityRole="header" className="px-1 pt-1">Split</Text>
      <SegmentedControl
        options={[{ key: 'equal', label: 'Equally' }, { key: 'exact', label: 'Exact' }, { key: 'percent', label: 'Percent' }]}
        value={form.method}
        onChange={(key) => setForm((f) => switchMethod(f, key as FormMethod, currency))}
      />
      <FieldGroup>
        {group.members.map((member, i) => {
          const checked = form.participants.includes(member.id);
          const share = shareOf(member.id);
          const label = displayName(member, group.meMemberID);
          const last = i === group.members.length - 1;
          const shareText = checked && share !== undefined && evaluated.amountMinor !== null ? formatCurrency(share, currency) : undefined;
          return (
            <CheckRow
              key={member.id}
              label={label}
              checked={checked}
              onToggle={() => setForm((f) => toggleParticipant(f, member.id, memberIds))}
              divider={!last}
              detail={form.method === 'percent' ? shareText : undefined}
              trailing={
                form.method === 'equal' ? (
                  shareText ? <Text variant="button">{shareText}</Text> : null
                ) : checked ? (
                  <View className="flex-row items-center gap-1">
                    {form.method === 'exact' ? <Text variant="body-small" tone="muted">{symbolOf(currency)}</Text> : null}
                    <TextInput
                      accessibilityLabel={`${label} ${form.method === 'exact' ? 'amount' : 'percent'}`}
                      value={form.method === 'exact' ? (form.amounts[member.id] ?? '') : (form.percents[member.id] ?? '')}
                      onChangeText={(text) => (form.method === 'exact' ? patch({ amounts: { ...form.amounts, [member.id]: decimalOnly(text) } }) : patch({ percents: { ...form.percents, [member.id]: decimalOnly(text) } }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      className="min-h-touch w-20 rounded-input border bg-background px-2 text-right text-body font-semibold text-fg"
                      style={{ borderColor: colors['field-border'], outlineStyle: 'none' } as never}
                    />
                    {form.method === 'percent' ? <Text variant="body-small" tone="muted">%</Text> : null}
                  </View>
                ) : null
              }
            />
          );
        })}
      </FieldGroup>
      {evaluated.errors.participants ? <Text variant="caption" tone="owe">{evaluated.errors.participants}</Text> : null}

      {issue && evaluated.amountMinor !== null ? (
        <View className="gap-2">
          <Banner tone="error" message={splitIssueMessage(issue, currency, evaluated.amountMinor, evaluated.shares)} />
          {issue.kind === 'short' && lastParticipant ? (
            <>
              <Button label={`Add ${formatCurrency(issue.diffMinor, currency)} to ${nameOf(lastParticipant)}`} variant="secondary" onPress={() => setForm((f) => addDifferenceTo(f, lastParticipant, currency, issue))} />
              <Button label="Split the rest equally" variant="secondary" onPress={() => setForm((f) => splitRestEqually(f, currency, issue))} />
            </>
          ) : null}
          {issue.kind === 'over' && lastParticipant ? (
            <Button label={`Take ${formatCurrency(issue.diffMinor, currency)} off ${nameOf(lastParticipant)}`} variant="secondary" onPress={() => setForm((f) => addDifferenceTo(f, lastParticipant, currency, issue))} />
          ) : null}
          {issue.kind === 'percent' ? <Button label="Split evenly" variant="secondary" onPress={() => setForm((f) => evenPercents(f))} /> : null}
        </View>
      ) : null}
      {!issue && touchedSplit && evaluated.amountMinor !== null ? (
        <Text variant="caption" tone="accent" className="px-1 font-semibold">{`Adds up to ${formatCurrency(evaluated.amountMinor, currency)}`}</Text>
      ) : null}
      {note ? <Text variant="body-small" tone="muted" className="px-1 text-[13px]">{note}</Text> : null}

      <Button label={mode === 'add' ? 'Save expense' : 'Save changes'} loading={busy} disabled={!evaluated.draft} onPress={save} />

      <Sheet visible={sheet === 'payer'} onClose={() => setSheet(null)} title="Paid by">
        <View className="overflow-hidden rounded-2xl bg-background">
          {group.members.map((m, i) => (
            <ListRow key={m.id} title={displayName(m, group.meMemberID)} divider={i < group.members.length - 1} accessibilityLabel={`${displayName(m, group.meMemberID)}${m.id === form.payerID ? ', selected' : ''}`} onPress={() => { patch({ payerID: m.id }); setSheet(null); }} />
          ))}
        </View>
      </Sheet>
      <Sheet visible={sheet === 'date'} onClose={() => setSheet(null)} title="Date">
        <View className="flex-row gap-2">
          <Button label="Today" variant="secondary" size="small" className="flex-1" onPress={() => { patch({ date: dayOffset(0) }); setSheet(null); }} />
          <Button label="Yesterday" variant="secondary" size="small" className="flex-1" onPress={() => { patch({ date: dayOffset(-1) }); setSheet(null); }} />
        </View>
        <FieldGroup>
          <FieldRow label="Date" value={form.date} onChangeText={(date) => patch({ date })} placeholder="2026-10-30" autoCapitalize="none" last />
        </FieldGroup>
        {evaluated.errors.date ? <Text variant="caption" tone="owe">{evaluated.errors.date}</Text> : null}
        <Button label="Done" disabled={Boolean(evaluated.errors.date)} onPress={() => setSheet(null)} />
      </Sheet>
      <Sheet visible={sheet === 'group'} onClose={() => setSheet(null)} title="Group">
        <View className="overflow-hidden rounded-2xl bg-background">
          {(groups ?? []).map((g, i, all) => (
            <ListRow key={g.group.id} title={g.group.name} divider={i < all.length - 1} accessibilityLabel={`${g.group.name}${g.group.id === group.id ? ', selected' : ''}`} onPress={() => { setSheet(null); onPickGroup?.(g.group.id); }} />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

function PickerRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const body = (
    <>
      <Text variant="body-small" tone="muted" className="w-[84px] shrink-0">{label}</Text>
      <Text variant="body" className="flex-1">{value}</Text>
      {onPress ? <Icon icon={ChevronRight} size={16} strokeWidth={2.2} tone="muted" /> : null}
    </>
  );
  const box = 'min-h-row flex-row items-center gap-3 border-b border-divider px-4';
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} onPress={onPress} className={`${box} active:opacity-80`}>{body}</Pressable>
  ) : (
    <View accessible accessibilityLabel={`${label}, ${value}`} className={box}>{body}</View>
  );
}
