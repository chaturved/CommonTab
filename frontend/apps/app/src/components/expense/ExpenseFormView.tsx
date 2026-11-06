import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { CATEGORIES, displayName, formatCurrency, longDate, type ExpenseForm, type LocalExpense } from '@commontab/core';
import { BackButton, Banner, FieldGroup, FieldLayoutProvider, FieldRow, Icon, Text, useThemeColors } from '@commontab/ui';
import { CurrencySelect } from '@/components/ui/CurrencySelect';
import { Dropdown } from '@/components/ui/Dropdown';
import { OptionList } from '@/components/ui/OptionList';
import { DateChooser } from '@/components/expense/DateChooser';
import { ForeignRate } from '@/components/expense/ForeignRate';
import { ExpenseSheets, type ExpenseSheet } from '@/components/expense/ExpenseSheets';
import { ExpenseActionBar } from '@/components/expense/ExpenseActionBar';
import { Screen } from '@/components/layout/Screen';
import { SplitSummaryCard, SplitSummaryRow } from '@/components/expense/SplitSummary';
import { PickerRow } from '@/components/ui/PickerRow';
import { clearExpenseDraft, publishExpenseDraft, useExpenseDraft, type ExpenseDraft } from '@/state/expenseDraft';
import { useExpenseForm } from '@/hooks/useExpenseForm';
import { useIsDesktop } from '@/hooks/useViewport';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { currencySymbol, decimalOnly } from '@/lib/amountInput';
import type { GroupData } from '@/types/group';

export function ExpenseFormView({ mode, data, expense, groups, onPickGroup, initial }: {
  mode: 'add' | 'edit';
  data: GroupData;
  expense?: LocalExpense;
  groups?: GroupData[];
  onPickGroup?: (id: string) => void;
  initial?: Partial<ExpenseForm>;
}) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const colors = useThemeColors();
  const status = useSyncStatus();
  const { group } = data;
  const currency = group.currencyCode;
  const { form, setForm, patch, evaluated, entry, keptRate, foreign, quote, quoting, pickCurrency, note, busy, problem, save } = useExpenseForm({ mode, data, expense, initial });
  const [sheet, setSheet] = useState<ExpenseSheet | null>(null);
  const { byItem } = useExpenseDraft();
  const editSplit = () => router.push('/split');
  const offline = status !== null && status.connectivity === 'offline';
  const memberIds = useMemo(() => group.members.map((m) => m.id), [group.members]);
  const people = useMemo(() => group.members.filter((m) => !m.removedAt || form.participants.includes(m.id) || m.id === form.payerID), [group.members, form.participants, form.payerID]);
  const draft = useMemo<ExpenseDraft>(() => ({ mode, form, setForm, patch, evaluated, group, people, memberIds, note }), [mode, form, setForm, patch, evaluated, group, people, memberIds, note]);
  useEffect(() => publishExpenseDraft(draft), [draft]);
  useEffect(() => clearExpenseDraft, []);
  const nameOf = (id: string) => {
    const member = group.members.find((m) => m.id === id);
    return member ? displayName(member, group.meMemberID) : 'Someone';
  };

  const rateBlock = foreign ? (
    <ForeignRate
      entry={entry}
      currency={currency}
      rateText={form.rateText}
      onRateText={(rateText) => patch({ rateText })}
      quote={quote}
      loading={quoting}
      kept={keptRate}
      countsAs={evaluated.amountMinor !== null ? formatCurrency(evaluated.amountMinor, currency) : null}
      error={evaluated.errors.rate && form.rateText !== '' ? evaluated.errors.rate : undefined}
    />
  ) : null;
  const currencyChip = (
    <CurrencySelect value={entry} onChange={pickCurrency}>
      {(open, isOpen) => (
        <Pressable accessibilityRole="button" accessibilityLabel={`Currency, ${entry}. Change`} onPress={open} className="min-h-touch flex-row items-center gap-1.5 rounded-pill border-[1.5px] border-accent bg-tint px-3.5 active:opacity-80">
          <Text variant="body-small" tone="accent" className="font-bold">{entry} {currencySymbol(entry)}</Text>
          <Icon icon={isOpen ? ChevronUp : ChevronDown} size={14} strokeWidth={2.4} tone="accent" />
        </Pressable>
      )}
    </CurrencySelect>
  );
  const dateLabel = evaluated.errors.date ? form.date : longDate(`${form.date}T12:00:00Z`);
  const banners = (
    <>
      {mode === 'edit' && offline ? (
        <Banner tone="warning" message={`You're offline. This edit is saved on ${desktop ? 'this browser' : 'your phone'} and sent when you reconnect. If someone else changes this expense first, you'll be asked which version to keep.`} />
      ) : null}
      {problem ? <Banner tone="error" message={problem} /> : null}
    </>
  );
  const splitRow = <SplitSummaryRow draft={draft} byItem={byItem} onEdit={editSplit} />;
  const splitCard = <SplitSummaryCard draft={draft} byItem={byItem} onEdit={editSplit} />;
  const sheets = <ExpenseSheets sheet={sheet} onClose={() => setSheet(null)} form={form} patch={patch} evaluated={evaluated} people={people} group={group} groups={groups} onPickGroup={onPickGroup} />;
  const picker = (label: string, value: string, onSheet: (() => void) | undefined, content?: (close: () => void) => ReactNode) => {
    if (!desktop || !content) return <PickerRow label={label} value={value} onPress={onSheet} />;
    return (
      <Dropdown label={label} width={320} align="end" content={content}>
        {(open, isOpen) => <PickerRow label={label} value={value} onPress={open} dropdown expanded={isOpen} />}
      </Dropdown>
    );
  };
  const choose = (close: () => void, changes: Partial<ExpenseForm>) => {
    patch(changes);
    close();
  };

  const title = mode === 'add' ? 'Add expense' : 'Edit expense';
  const saveLabel = mode === 'add' ? 'Save expense' : 'Save changes';
  const ready = Boolean(evaluated.draft);
  const sharing = form.participants.length;
  const firstError = evaluated.errors.amount ?? evaluated.errors.participants ?? evaluated.errors.date ?? evaluated.errors.rate;
  const summary = evaluated.draft && evaluated.amountMinor !== null
    ? `${formatCurrency(evaluated.amountMinor, currency)} paid by ${nameOf(form.payerID)}, split ${sharing === 1 ? 'with 1 person' : `between ${sharing} people`}`
    : form.amountText === '' ? 'Enter an amount to continue.' : (firstError ?? 'Check the split to continue.');

  const header = desktop ? (
    <View className="min-h-touch flex-row items-center gap-3">
      <BackButton onPress={() => router.back()} />
      <Text variant="large-title" accessibilityRole="header" className="text-2xl leading-8">{title}</Text>
    </View>
  ) : (
    <View className="min-h-touch flex-row items-center justify-between">
      <BackButton onPress={() => router.back()} />
      <Text variant="screen-title" accessibilityRole="header">{title}</Text>
      <View className="w-11" />
    </View>
  );

  const description = (
    <FieldRow label="Description" value={form.merchant} onChangeText={(merchant) => patch({ merchant })} placeholder="Dinner at Uchi" maxLength={120} autoCapitalize="sentences" last />
  );

  const amountCard = (
    <View className={`gap-1 rounded-card bg-card px-4 pt-3 ${desktop ? 'overflow-hidden pb-0' : 'pb-3'}`}>
      <Text variant="caption" tone="muted" className="text-[13px] font-bold">Amount</Text>
      <View className="flex-row items-center gap-2">
        {currencyChip}
        <TextInput
          accessibilityLabel="Amount"
          value={form.amountText}
          onChangeText={(text) => patch({ amountText: decimalOnly(text) })}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.muted}
          autoFocus={mode === 'add'}
          editable={!byItem}
          className="min-h-[48px] min-w-0 flex-1 text-[34px] font-extrabold text-fg"
          style={{ outlineStyle: 'none' } as never}
        />
      </View>
      {foreign ? (
        <View className="mt-1 flex-row items-center justify-between border-t border-divider pt-3">
          <Text variant="body-small" tone="fg-soft">Group currency</Text>
          <Text variant="body-small" className="font-bold">{currency} {currencySymbol(currency)}</Text>
        </View>
      ) : null}
      {evaluated.errors.amount && form.amountText !== '' ? <Text variant="caption" tone="owe">{evaluated.errors.amount}</Text> : null}
      {desktop ? <View className="-mx-4 mt-2 border-t border-divider">{description}</View> : null}
    </View>
  );

  const groupPicker = picker('Group', group.name, groups && groups.length > 1 ? () => setSheet('group') : undefined, groups && groups.length > 1 ? (close) => <OptionList options={groups.map((g) => ({ id: g.group.id, label: g.group.name }))} selectedId={group.id} onSelect={(id) => { close(); onPickGroup?.(id); }} /> : undefined);
  const payerPicker = picker('Paid by', nameOf(form.payerID), () => setSheet('payer'), (close) => <OptionList options={people.map((m) => ({ id: m.id, label: displayName(m, group.meMemberID) }))} selectedId={form.payerID} onSelect={(payerID) => choose(close, { payerID })} />);
  const datePicker = picker('Date', dateLabel, () => setSheet('date'), (close) => <View className="gap-3 p-3.5"><DateChooser date={form.date} error={evaluated.errors.date} onChange={(date) => patch({ date })} onDone={close} /></View>);
  const categoryPicker = picker('Category', CATEGORIES.find((c) => c.id === form.category)?.label ?? 'Other', () => setSheet('category'), (close) => <OptionList options={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))} selectedId={form.category} onSelect={(category) => choose(close, { category })} />);
  const notes = <FieldRow label="Notes" value={form.notes} onChangeText={(notes) => patch({ notes })} placeholder="Optional" maxLength={500} last />;

  const chips = (
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
  );

  const actions = <ExpenseActionBar desktop={desktop} label={saveLabel} summary={summary} ready={ready} busy={busy} onCancel={() => router.back()} onSave={save} />;

  if (desktop) {
    return (
      <Screen wide footer={actions}>
        <View className="w-full max-w-[960px] gap-4 self-start">
          {header}
          {banners}
          {amountCard}
          {rateBlock}
          <FieldLayoutProvider layout="stacked">
            <View className="gap-3">
              <View className="flex-row gap-3">
                <View className="min-w-0 flex-1">{groupPicker}</View>
                <View className="min-w-0 flex-1">{payerPicker}</View>
                <View className="min-w-0 flex-1">{datePicker}</View>
                <View className="min-w-0 flex-1">{categoryPicker}</View>
              </View>
              {notes}
            </View>
          </FieldLayoutProvider>
          {splitCard}
          {sheets}
        </View>
      </Screen>
    );
  }

  return (
    <Screen wide footer={actions}>
      {header}
      {banners}
      {amountCard}
      {rateBlock}
      <FieldGroup>
        {description}
        {groupPicker}
        {payerPicker}
        {datePicker}
        {splitRow}
        {notes}
      </FieldGroup>
      {chips}
      {sheets}
    </Screen>
  );
}
