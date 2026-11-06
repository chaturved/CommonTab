import { useState, type Dispatch, type SetStateAction } from 'react';
import { ScrollView, View } from 'react-native';
import { applyItemized, CATEGORIES, displayName, type ExpenseForm, type FormEvaluation, type ItemizedResult, type LocalGroup, type Member } from '@commontab/core';
import { Button, ListRow, Sheet } from '@commontab/ui';
import { DateChooser } from '@/components/expense/DateChooser';
import { ItemizedEditor } from '@/components/expense/ItemizedEditor';
import type { GroupData } from '@/types/group';

export type ExpenseSheet = 'payer' | 'date' | 'group' | 'item' | 'category';

interface Props {
  sheet: ExpenseSheet | null;
  onClose: () => void;
  form: ExpenseForm;
  setForm: Dispatch<SetStateAction<ExpenseForm>>;
  patch: (changes: Partial<ExpenseForm>) => void;
  evaluated: FormEvaluation;
  people: Member[];
  group: LocalGroup;
  groups?: GroupData[];
  onPickGroup?: (id: string) => void;
}

export function ExpenseSheets({ sheet, onClose, form, setForm, patch, evaluated, people, group, groups, onPickGroup }: Props) {
  const [itemResult, setItemResult] = useState<ItemizedResult | null>(null);
  const currency = group.currencyCode;
  const choose = (changes: Partial<ExpenseForm>) => {
    patch(changes);
    onClose();
  };

  return (
    <>
      <Sheet visible={sheet === 'payer'} onClose={onClose} title="Paid by">
        <View className="overflow-hidden rounded-2xl bg-background">
          {people.map((m, i) => (
            <ListRow key={m.id} title={displayName(m, group.meMemberID)} divider={i < people.length - 1} accessibilityLabel={`${displayName(m, group.meMemberID)}${m.id === form.payerID ? ', selected' : ''}`} onPress={() => choose({ payerID: m.id })} />
          ))}
        </View>
      </Sheet>
      <Sheet visible={sheet === 'date'} onClose={onClose} title="Date">
        <DateChooser date={form.date} error={evaluated.errors.date} onChange={(date) => patch({ date })} onDone={onClose} />
      </Sheet>
      <Sheet visible={sheet === 'item'} onClose={onClose} title="Split by item">
        <ScrollView className="max-h-[460px]" keyboardShouldPersistTaps="handled">
          <ItemizedEditor people={people.map((m) => ({ id: m.id, name: displayName(m, group.meMemberID) }))} currencyCode={currency} onResult={setItemResult} />
        </ScrollView>
        <Button label="Use this split" disabled={!itemResult} onPress={() => { if (itemResult) setForm((f) => applyItemized(f, itemResult, currency)); onClose(); }} />
      </Sheet>
      <Sheet visible={sheet === 'category'} onClose={onClose} title="Category">
        <View className="overflow-hidden rounded-2xl bg-background">
          {CATEGORIES.map((c, i) => (
            <ListRow key={c.id} title={c.label} divider={i < CATEGORIES.length - 1} accessibilityLabel={`${c.label}${c.id === form.category ? ', selected' : ''}`} onPress={() => choose({ category: c.id })} />
          ))}
        </View>
      </Sheet>
      <Sheet visible={sheet === 'group'} onClose={onClose} title="Group">
        <View className="overflow-hidden rounded-2xl bg-background">
          {(groups ?? []).map((g, i, all) => (
            <ListRow key={g.group.id} title={g.group.name} divider={i < all.length - 1} accessibilityLabel={`${g.group.name}${g.group.id === group.id ? ', selected' : ''}`} onPress={() => { onClose(); onPickGroup?.(g.group.id); }} />
          ))}
        </View>
      </Sheet>
    </>
  );
}
