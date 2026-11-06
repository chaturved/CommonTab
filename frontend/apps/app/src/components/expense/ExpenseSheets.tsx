import { View } from 'react-native';
import { CATEGORIES, displayName, type ExpenseForm, type FormEvaluation, type LocalGroup, type Member } from '@commontab/core';
import { ListRow, Sheet } from '@commontab/ui';
import { DateChooser } from '@/components/expense/DateChooser';
import type { GroupData } from '@/types/group';

export type ExpenseSheet = 'payer' | 'date' | 'group' | 'category';

interface Props {
  sheet: ExpenseSheet | null;
  onClose: () => void;
  form: ExpenseForm;
  patch: (changes: Partial<ExpenseForm>) => void;
  evaluated: FormEvaluation;
  people: Member[];
  group: LocalGroup;
  groups?: GroupData[];
  onPickGroup?: (id: string) => void;
}

export function ExpenseSheets({ sheet, onClose, form, patch, evaluated, people, group, groups, onPickGroup }: Props) {
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
        <DateChooser date={form.date} onChange={(date) => patch({ date })} onDone={onClose} />
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
