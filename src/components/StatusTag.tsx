import type { CategoryType, ShiftType } from '../types/handover';

export function ShiftTag({ shift }: { shift: ShiftType }) {
  const styles: Record<ShiftType, string> = {
    'Shift 1': 'bg-slate-900/5 text-slate-900 border-slate-300',
    'Shift 2': 'bg-teal-50 text-teal-800 border-teal-200',
    'Shift 3': 'bg-amber-50 text-amber-800 border-amber-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded whitespace-nowrap shrink-0 tabular-nums ${styles[shift]}`}
    >
      {shift}
    </span>
  );
}

export function CategoryTag({ category }: { category: CategoryType }) {
  const styles: Record<CategoryType, string> = {
    OVERHAUL: 'bg-blue-50 text-[#0F294A] border-blue-200',
    'STABILITY TINGGI': 'bg-emerald-50 text-emerald-800 border-emerald-200',
    'CASE PERBAIKAN PART': 'bg-rose-50 text-rose-800 border-rose-200',
    'COMMISSIONING / TRIAL / CHANGE OVER': 'bg-slate-100 text-slate-800 border-slate-300',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded whitespace-nowrap shrink-0 ${styles[category]}`}
    >
      {category}
    </span>
  );
}
