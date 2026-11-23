import type { CategoryType, ShiftType } from '../../shared/types/handover';

export function ShiftTag({ shift }: { shift: ShiftType }) {
  const styles: Record<ShiftType, string> = {
    'Shift 1':
      'bg-slate-900/5 text-slate-900 border-slate-300 dark:bg-[#1D212A] dark:text-zinc-200 dark:border-zinc-700/80',
    'Shift 2':
      'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-900/25 dark:text-dark-accent dark:border-teal-800/50',
    'Shift 3':
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/25 dark:text-amber-200/90 dark:border-amber-800/50',
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
    OVERHAUL:
      'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-900/25 dark:text-dark-accent dark:border-teal-800/50',
    'STABILITY TINGGI':
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300/90 dark:border-emerald-800/50',
    'CASE PERBAIKAN PART':
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/25 dark:text-rose-300/90 dark:border-rose-800/50',
    'COMMISSIONING / TRIAL / CHANGE OVER':
      'bg-slate-100 text-slate-800 border-slate-300 dark:bg-[#1D212A] dark:text-zinc-300 dark:border-zinc-700/80',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded whitespace-nowrap shrink-0 ${styles[category]}`}
    >
      {category}
    </span>
  );
}
