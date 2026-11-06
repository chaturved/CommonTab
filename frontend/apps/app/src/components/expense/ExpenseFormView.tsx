import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { CATEGORIES, displayName, formatCurrency, longDate, type ExpenseForm, type LocalExpense } from '@commontab/core';
import { Banner, Button, FieldGroup, FieldRow, Text, useThemeColors } from '@commontab/ui';
import { CurrencySelect } from '@/components/ui/CurrencySelect';
import { DesktopDialog } from '@/components/ui/DesktopDialog';
import { ForeignRate } from '@/components/expense/ForeignRate';
import { ExpenseSheets, type ExpenseSheet } from '@/components/expense/ExpenseSheets';
import { SplitEditor } from '@/components/expense/SplitEditor';
import { PickerRow } from '@/components/ui/PickerRow';
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
  const offline = status !== null && status.connectivity === 'offline';
  const memberIds = group.members.map((m) => m.id);
  const people = group.members.filter((m) => !m.removedAt || form.participants.includes(m.id) || m.id === form.payerID);
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
      {(open) => (
        <Pressable accessibilityRole="button" accessibilityLabel={`Currency, ${entry}. Change`} onPress={open} className="min-h-touch justify-center rounded-pill bg-tint px-3 active:opacity-80">
          <Text variant="body-small" tone="accent" className="font-bold">{entry} ▾</Text>
        </Pressable>
      )}
    </CurrencySelect>
  );
  const banners = (
    <>
      {mode === 'edit' && offline ? (
        <Banner tone="warning" message={`You're offline. This edit is saved on ${desktop ? 'this browser' : 'your phone'} and sent when you reconnect. If someone else changes this expense first, you'll be asked which version to keep.`} />
      ) : null}
      {problem ? <Banner tone="error" message={problem} /> : null}
    </>
  );
  const split = <SplitEditor form={form} setForm={setForm} patch={patch} evaluated={evaluated} people={people} memberIds={memberIds} group={group} desktop={desktop} note={note} onPickItems={() => setSheet('item')} />;
  const sheets = <ExpenseSheets sheet={sheet} onClose={() => setSheet(null)} form={form} setForm={setForm} patch={patch} evaluated={evaluated} people={people} group={group} groups={groups} onPickGroup={onPickGroup} />;
  const fieldBox = 'min-h-[44px] flex-row items-center justify-between rounded-input border bg-card px-3.5';

  if (desktop) {
    return (
      <DesktopDialog
        title={mode === 'add' ? 'Add expense' : 'Edit expense'}
        onClose={() => router.back()}
        headerRight={groups && groups.length > 1 ? <Button label={`${group.name} ▾`} variant="ghost" size="small" accessibilityLabel={`Group, ${group.name}. Change group`} onPress={() => setSheet('group')} /> : <Text variant="body-small" tone="muted">{group.name}</Text>}
        primary={{ label: mode === 'add' ? 'Save expense' : 'Save changes', onPress: save, disabled: !evaluated.draft, loading: busy }}
      >
        {banners}
        <View className="flex-row gap-3">
          <View className="flex-[1.4]">
            <FieldRow label="Description" value={form.merchant} onChangeText={(merchant) => patch({ merchant })} placeholder="Dinner at Uchi" maxLength={120} autoCapitalize="sentences" />
          </View>
          <View className="flex-1 gap-1.5">
            <Text variant="caption" tone="muted" className="text-[13px] font-bold">Amount</Text>
            <View className={fieldBox} style={{ borderColor: colors['field-border'] }}>
              <Text variant="body" tone="muted">{currencySymbol(entry)}</Text>
              <TextInput accessibilityLabel="Amount" value={form.amountText} onChangeText={(text) => patch({ amountText: decimalOnly(text) })} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} autoFocus={mode === 'add'} className="min-h-[44px] min-w-0 flex-1 pl-2 text-body font-semibold text-fg" style={{ outlineStyle: 'none' } as never} />
              {currencyChip}
            </View>
          </View>
        </View>
        {rateBlock}
        <View className="flex-row gap-3">
          <View className="flex-1"><PickerRow label="Paid by" value={nameOf(form.payerID)} onPress={() => setSheet('payer')} /></View>
          <View className="flex-1"><PickerRow label="Date" value={evaluated.errors.date ? form.date : longDate(`${form.date}T12:00:00Z`)} onPress={() => setSheet('date')} /></View>
          <View className="flex-1"><PickerRow label="Category" value={CATEGORIES.find((c) => c.id === form.category)?.label ?? 'Other'} onPress={() => setSheet('category')} /></View>
        </View>
        <FieldRow label="Notes" value={form.notes} onChangeText={(notes) => patch({ notes })} placeholder="Optional" maxLength={500} />
        {split}
        {sheets}
      </DesktopDialog>
    );
  }

  return (
    <View className="w-full gap-4">
      <View className="min-h-touch flex-row items-center justify-between">
        <Button label="Cancel" variant="ghost" size="small" onPress={() => router.back()} />
        <Text variant="screen-title" accessibilityRole="header">{mode === 'add' ? 'Add expense' : 'Edit expense'}</Text>
        <View className="w-[72px]" />
      </View>

      {banners}

      <View className="gap-1 rounded-card bg-card px-4 py-3">
        <Text variant="caption" tone="muted" className="text-[13px] font-bold">Amount</Text>
        <View className="flex-row items-center gap-2">
          <Text variant="large-title" tone="muted" className="text-[34px]">{currencySymbol(entry)}</Text>
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
          {currencyChip}
        </View>
        {evaluated.errors.amount && form.amountText !== '' ? <Text variant="caption" tone="owe">{evaluated.errors.amount}</Text> : null}
      </View>

      {rateBlock}

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

      {split}

      <Button label={mode === 'add' ? 'Save expense' : 'Save changes'} loading={busy} disabled={!evaluated.draft} onPress={save} />

      {sheets}
    </View>
  );
}
