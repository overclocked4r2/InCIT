import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props { open: boolean; onClose: () => void; }
interface Item { id: string; label: string; hint: string; to: string; }

const PAGES: Item[] = [
  { id: 'dashboard', label: 'Overview', hint: 'Schedule health and system metrics', to: '/dashboard' },
  { id: 'timetable', label: 'Solver & timetable', hint: 'Generate and inspect the timetable', to: '/timetable' },
  { id: 'exams', label: 'Exam schedule', hint: 'Allocated exam rooms and sessions', to: '/exams' },
  { id: 'spectra', label: 'Spectra Week', hint: 'Booking decisions and priority', to: '/spectra' },
  { id: 'booking', label: 'NL booking', hint: 'Try a booking request', to: '/booking' },
  { id: 'disruption', label: 'Disruptions', hint: 'Test changes to the timetable', to: '/disruption' },
  { id: 'audit', label: 'Audit trail', hint: 'View actions and exports', to: '/audit' },
];

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return PAGES.filter(p => !needle || p.label.toLowerCase().includes(needle) || p.hint.toLowerCase().includes(needle));
  }, [query]);

  useEffect(() => { if (active >= items.length) setActive(0); }, [items.length, active]);
  if (!open) return null;

  const go = (item: Item) => { navigate(item.to); onClose(); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    if (e.key === 'Enter' && items[active]) { e.preventDefault(); go(items[active]); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="spatial-dialog relative w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-2xl overflow-hidden animate-fade-up">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]"><span className="text-[var(--color-text-muted)]">⌕</span><input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search pages…" className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none" /><kbd className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)]">ESC</kbd></div>
        <div className="max-h-[52vh] overflow-y-auto py-2">
          {items.length === 0 && <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">No matching pages</div>}
          {items.map((item, index) => <button key={item.id} onMouseEnter={() => setActive(index)} onClick={() => go(item)} className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${index === active ? 'bg-[var(--color-accent-dim)]' : 'hover:bg-[var(--color-surface-2)]'}`}><span className={`w-1.5 h-1.5 rounded-full ${index === active ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-4)]'}`} /><span className="flex-1 min-w-0"><span className="block text-sm text-[var(--color-text-primary)] truncate">{item.label}</span><span className="block text-[11px] text-[var(--color-text-muted)] truncate">{item.hint}</span></span><span className="text-[10px] text-[var(--color-text-muted)]">↵</span></button>)}
        </div>
      </div>
    </div>
  );
}
