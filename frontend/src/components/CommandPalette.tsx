import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { PortalSearchResults } from '../types';
import { useStudent } from '../StudentContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Item {
  id: string;
  label: string;
  hint: string;
  group: string;
  to: string;
}

const PAGES: Item[] = [
  { id: 'p-home', label: 'Home', hint: 'Your campus dashboard', group: 'Pages', to: '/home' },
  { id: 'p-tt', label: 'My timetable', hint: 'Weekly class grid', group: 'Pages', to: '/my-timetable' },
  { id: 'p-att', label: 'Attendance', hint: '75% tracking and logging', group: 'Pages', to: '/attendance' },
  { id: 'p-marks', label: 'Marks & CGPA', hint: 'Internal marks and SGPA', group: 'Pages', to: '/marks' },
  { id: 'p-exams', label: 'Exam timetable', hint: 'Seat plans and exam slots', group: 'Pages', to: '/exams' },
  { id: 'p-plan', label: 'Planner', hint: 'Week, free blocks and exams', group: 'Pages', to: '/planner' },
  { id: 'p-notes', label: 'Notes', hint: 'Course notes and revision', group: 'Pages', to: '/notes' },
  { id: 'p-life', label: 'Campus life', hint: 'Events, clubs and mess', group: 'Pages', to: '/campus-life' },
  { id: 'p-admin', label: 'Scheduler overview', hint: 'Admin KPIs and validation', group: 'Pages', to: '/dashboard' },
];

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { studentId } = useStudent();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PortalSearchResults | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setActive(0);
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults(null);
      return;
    }
    const handle = window.setTimeout(() => {
      api.portalSearch(query.trim(), studentId).then(setResults).catch(() => setResults(null));
    }, 140);
    return () => window.clearTimeout(handle);
  }, [query, open, studentId]);

  const items = useMemo<Item[]>(() => {
    const needle = query.trim().toLowerCase();
    const pages = PAGES.filter(p => !needle || p.label.toLowerCase().includes(needle) || p.hint.toLowerCase().includes(needle));
    if (!results) return pages;
    return [
      ...pages,
      ...results.courses.map(c => ({ id: `c-${c.id}`, label: c.title, hint: `${c.id} · course`, group: 'Courses', to: '/marks' })),
      ...results.faculty.map(f => ({ id: `f-${f.id}`, label: f.name, hint: `${f.department} · faculty`, group: 'Faculty', to: '/my-timetable' })),
      ...results.rooms.map(r => ({ id: `r-${r.id}`, label: r.name, hint: `${r.id} · ${r.building}`, group: 'Rooms', to: '/my-timetable' })),
      ...results.events.map(e => ({ id: `e-${e.request_id}`, label: e.title, hint: `${e.day} ${e.start} · ${e.room}`, group: 'Events', to: '/campus-life' })),
    ];
  }, [query, results]);

  useEffect(() => {
    if (active >= items.length) setActive(0);
  }, [items.length, active]);

  if (!open) return null;

  const go = (item: Item) => {
    navigate(item.to);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(items.length - 1, a + 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(0, a - 1));
    }
    if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      go(items[active]);
    }
  };

  const groups = items.reduce<Record<string, Item[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});
  const activeItem = items[active];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-2xl overflow-hidden animate-fade-up">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <span className="text-[var(--color-text-muted)]">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, courses, faculty, rooms, events…"
            className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)]">ESC</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-2">
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
              No matches for “{query}”
            </div>
          )}
          {Object.entries(groups).map(([group, groupItems]) => (
            <div key={group} className="mb-1">
              <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{group}</div>
              {groupItems.map(item => {
                const index = items.indexOf(item);
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                      index === active ? 'bg-[var(--color-accent-dim)]' : 'hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${index === active ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-4)]'}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-[var(--color-text-primary)] truncate">{item.label}</span>
                      <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{item.hint}</span>
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">↵</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto">{activeItem ? activeItem.hint : 'Type at least 2 characters to search the campus'}</span>
        </div>
      </div>
    </div>
  );
}
