import type { CategoryType, ShiftType } from '../types/handover';

export function ShiftTag({ shift }: { shift: ShiftType }) {
  const styles: Record<ShiftType, string> = {
    'Shift 1':
      'bg-slate-900/5 text-slate-900 border-slate-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700/80',
    'Shift 2':
      'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/70',
    'Shift 3':
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/55 dark:text-amber-300 dark:border-amber-800/70',
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
      'bg-blue-50 text-[#0F294A] border-blue-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/70',
    'STABILITY TINGGI':
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
    'CASE PERBAIKAN PART':
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70',
    'COMMISSIONING / TRIAL / CHANGE OVER':
      'bg-slate-100 text-slate-800 border-slate-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700/80',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded whitespace-nowrap shrink-0 ${styles[category]}`}
    >
      {category}
    </span>
  );
}
