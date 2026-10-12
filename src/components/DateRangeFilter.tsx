import React from 'react';
import { cn } from '../lib/utils';
import { dateKey } from '../lib/report';

// Filtro de período com atalhos + calendário (data inicial e final).
// start/end são 'yyyy-MM-dd' (ou null = sem limite / "Tudo").
export interface DateRange {
  start: string | null;
  end: string | null;
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const today = () => dateKey(new Date());
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateKey(d);
};
const monthStart = () => {
  const d = new Date();
  return dateKey(new Date(d.getFullYear(), d.getMonth(), 1));
};

const PRESETS: { id: string; label: string; range: () => DateRange }[] = [
  { id: 'today', label: 'Hoje', range: () => ({ start: today(), end: today() }) },
  { id: 'week', label: '7 dias', range: () => ({ start: daysAgo(6), end: today() }) },
  { id: 'month', label: 'Mês atual', range: () => ({ start: monthStart(), end: today() }) },
  { id: '30', label: '30 dias', range: () => ({ start: daysAgo(29), end: today() }) },
  { id: 'all', label: 'Tudo', range: () => ({ start: null, end: null }) },
];

const matchesPreset = (v: DateRange, id: string): boolean => {
  const p = PRESETS.find(x => x.id === id);
  if (!p) return false;
  const r = p.range();
  return r.start === v.start && r.end === v.end;
};

const DateRangeFilter: React.FC<Props> = ({ value, onChange, className }) => {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center gap-3', className)}>
      <div className="flex flex-wrap bg-gray-100 p-1 rounded-lg">
        {PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.range())}
            className={cn(
              'px-3 py-1.5 text-xs font-bold rounded-md transition-all',
              matchesPreset(value, p.id) ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs font-medium text-gray-500">
          De
          <input
            type="date"
            value={value.start || ''}
            max={value.end || undefined}
            onChange={(e) => onChange({ ...value, start: e.target.value || null })}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
          />
        </label>
        <label className="flex items-center gap-1 text-xs font-medium text-gray-500">
          até
          <input
            type="date"
            value={value.end || ''}
            min={value.start || undefined}
            onChange={(e) => onChange({ ...value, end: e.target.value || null })}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
          />
        </label>
      </div>
    </div>
  );
};

export default DateRangeFilter;
