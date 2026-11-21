import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import {
  APK_MACHINES,
  AST_MACHINES,
  MACHINE_OPTIONS,
  OTHER_MACHINES,
} from '../../shared/types/handover';

interface MachinePickerProps {
  id: string;
  value: string;
  activeMachines?: string[];
  required?: boolean;
  onChange: (nextMachine: string) => void;
}

export function MachinePicker({
  id,
  value,
  activeMachines = [],
  required = false,
  onChange,
}: MachinePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();

  const isCustomLegacyMachine =
    Boolean(value) &&
    !MACHINE_OPTIONS.includes(value as (typeof MACHINE_OPTIONS)[number]);

  const activeSet = useMemo(
    () => new Set(activeMachines.map((m) => m.toUpperCase())),
    [activeMachines]
  );

  const filteredGroups = useMemo(() => {
    const match = (name: string) =>
      !normalizedQuery || name.toLowerCase().includes(normalizedQuery);

    const groups: { label: string; isActiveGroup?: boolean; items: string[] }[] = [];

    if (activeMachines.length > 0) {
      const matchedActive = activeMachines.filter(match);
      if (matchedActive.length > 0) {
        groups.push({
          label: `Sedang Aktif (${matchedActive.length})`,
          isActiveGroup: true,
          items: matchedActive,
        });
      }
    }

    if (isCustomLegacyMachine && match(value)) {
      groups.push({
        label: 'Mesin Tersimpan',
        items: [value],
      });
    }

    const ast = AST_MACHINES.filter((m) => match(m));
    if (ast.length > 0) {
      groups.push({ label: `Seri AST (${ast.length})`, items: [...ast] });
    }

    const apk = APK_MACHINES.filter((m) => match(m));
    if (apk.length > 0) {
      groups.push({ label: `Seri APK (${apk.length})`, items: [...apk] });
    }

    const other = OTHER_MACHINES.filter((m) => match(m));
    if (other.length > 0) {
      groups.push({ label: `Lainnya (${other.length})`, items: [...other] });
    }

    return groups;
  }, [activeMachines, isCustomLegacyMachine, value, normalizedQuery]);

  function handleSelect(machineName: string) {
    onChange(machineName);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full min-h-[42px] px-3.5 py-2 text-sm font-mono border rounded-xl bg-white dark:bg-[#07080A] flex items-center justify-between gap-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-teal-600/25 focus:border-teal-600 dark:focus:ring-teal-500/60 ${
          open
            ? 'border-teal-600 dark:border-teal-500 ring-2 ring-teal-600/20 dark:ring-teal-500/25'
            : 'border-slate-300 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-700'
        }`}
      >
        <span
          className={`truncate flex items-center gap-2 ${
            value
              ? 'text-slate-900 dark:text-zinc-100 font-semibold'
              : 'text-slate-400 dark:text-zinc-500 font-sans font-normal'
          }`}
        >
          {value && activeSet.has(value.toUpperCase()) && (
            <span
              className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0"
              aria-hidden="true"
            />
          )}
          <span>{value || 'Pilih atau cari mesin...'}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Daftar Pilihan Mesin"
          className="absolute left-0 right-0 mt-1.5 z-40 bg-white dark:bg-[#0D0F12] rounded-xl border border-slate-200 dark:border-zinc-800 shadow-lg shadow-slate-900/10 dark:shadow-black/80 overflow-hidden"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-[#121417]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari mesin (misal: AST 25, APK 19, K1)..."
                aria-label="Cari kode mesin"
                className="w-full min-h-[36px] pl-8 pr-8 py-1.5 text-xs sm:text-sm border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-[#07080A] text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-600/25 focus:border-teal-600 dark:focus:ring-teal-500/60 dark:focus:border-teal-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Hapus pencarian mesin"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-[#1C2027] flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-zinc-800/70">
            {filteredGroups.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500 dark:text-zinc-400">
                Mesin &ldquo;{query}&rdquo; tidak ditemukan.
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.label} className="py-1">
                  <div
                    className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
                      group.isActiveGroup
                        ? 'text-amber-700 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/35'
                        : 'text-slate-500 dark:text-zinc-400 bg-slate-50/60 dark:bg-[#121417]'
                    }`}
                  >
                    {group.label}
                  </div>
                  <div className="py-0.5">
                    {group.items.map((item) => {
                      const selected = value.toUpperCase() === item.toUpperCase();
                      const isActive = activeSet.has(item.toUpperCase());
                      return (
                        <button
                          key={`${group.label}-${item}`}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => handleSelect(item)}
                          className={`w-full px-3.5 py-2 text-left text-xs sm:text-sm font-mono flex items-center justify-between gap-2 transition-colors ${
                            selected
                              ? 'bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 font-bold'
                              : 'text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-[#16191F]'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0 truncate">
                            {isActive && (
                              <span
                                className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                            <span className="truncate">{item}</span>
                          </span>
                          {selected && (
                            <Check className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
