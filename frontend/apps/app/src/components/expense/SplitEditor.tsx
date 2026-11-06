import type { Dispatch, SetStateAction } from 'react';
import { TextInput, View } from 'react-native';
import {
  addDifferenceTo, displayName, evenPercents, formatCurrency, splitIssueMessage, splitRestEqually, switchMethod, toggleParticipant,
  type ExpenseForm, type FormEvaluation, type FormMethod, type LocalGroup, type Member,
} from '@commontab/core';
import { Avatar, Banner, Button, CheckRow, FieldGroup, SegmentedControl, Text, useThemeColors } from '@commontab/ui';
import { currencySymbol, decimalOnly } from '@/lib/amountInput';

const METHODS = [{ key: 'equal', label: 'Equally' }, { key: 'exact', label: 'Exact' }, { key: 'percent', label: 'Percent' }, { key: 'item', label: 'By item' }];

interface Props {
  form: ExpenseForm;
  setForm: Dispatch<SetStateAction<ExpenseForm>>;
  patch: (changes: Partial<ExpenseForm>) => void;
  evaluated: FormEvaluation;
  people: Member[];
  memberIds: string[];
  group: LocalGroup;
  desktop: boolean;
  note: string | null;
  onPickItems: () => void;
}

export function SplitEditor({ form, setForm, patch, evaluated, people, memberIds, group, desktop, note, onPickItems }: Props) {
  const colors = useThemeColors();
  const currency = group.currencyCode;
  const issue = evaluated.split && form.method !== 'equal' ? evaluated.split : null;
  const touchedSplit = form.method !== 'equal';
  const lastParticipant = form.participants[form.participants.length - 1];
  const nameOf = (id: string) => {
    const member = group.members.find((m) => m.id === id);
    return member ? displayName(member, group.meMemberID) : 'Someone';
  };
  const shareOf = (id: string) => evaluated.shares.find((s) => s.memberID === id)?.minorUnits;
  const Rows = desktop ? DesktopRows : FieldGroup;

  return (
    <>
      <Text variant="section" accessibilityRole="header" className="px-1 pt-1">Split</Text>
      <SegmentedControl
        options={METHODS}
        value={form.method}
        onChange={(key) => (key === 'item' ? onPickItems() : setForm((f) => switchMethod(f, key as FormMethod, currency)))}
      />
      <Rows>
        {people.map((member, i) => {
          const checked = form.participants.includes(member.id);
          const share = shareOf(member.id);
          const label = displayName(member, group.meMemberID);
          const shareText = checked && share !== undefined && evaluated.amountMinor !== null ? formatCurrency(share, currency) : undefined;
          return (
            <CheckRow
              key={member.id}
              label={label}
              checked={checked}
              onToggle={() => setForm((f) => toggleParticipant(f, member.id, memberIds))}
              divider={i < people.length - 1}
              leading={desktop ? <Avatar name={member.name} id={member.id} /> : undefined}
              detail={form.method === 'percent' ? shareText : undefined}
              trailing={
                form.method === 'equal' ? (
                  shareText ? <Text variant="button">{shareText}</Text> : null
                ) : checked ? (
                  <View className="flex-row items-center gap-1">
                    {form.method === 'exact' ? <Text variant="body-small" tone="muted">{currencySymbol(currency)}</Text> : null}
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
      </Rows>
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
    </>
  );
}

function DesktopRows({ children }: { children: React.ReactNode }) {
  return <View className="overflow-hidden rounded-card bg-card">{children}</View>;
}
