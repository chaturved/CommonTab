import { SplitScreen } from '@/components/expense/SplitScreen';

export default function AddExpenseSplit() {
  return <SplitScreen fallback="/expenses/new" />;
}
