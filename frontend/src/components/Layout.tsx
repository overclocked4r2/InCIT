import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useStudent } from '../StudentContext';
import { CommandPalette } from './CommandPalette';
import { StudentSwitcher } from './StudentSwitcher';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const CAMPUS_NAV: NavItem[] = [
  { to: '/home', label: 'Home', icon: '◈' },
  { to: '/my-timetable', label: 'My timetable', icon: '▦' },
  { to: '/attendance', label: 'Attendance', icon: '◔' },
  { to: '/marks', label: 'Marks & CGPA', icon: '✦' },
  { to: '/exams', label: 'Exam timetable', icon: '◇' },
  { to: '/planner', label: 'Planner', icon: '◷' },
  { to: '/notes', label: 'Notes', icon: '✐' },
  { to: '/campus-life', label: 'Campus life', icon: '★' },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: '⚙' },
  { to: '/timetable', label: 'Solver & timetable', icon: '▶' },
  { to: '/spectra', label: 'Spectra Week', icon: '✹' },
  { to: '/booking', label: 'NL booking', icon: '✎' },
  { to: '/disruption', label: 'Disruptions', icon: '⚡' },
  { to: '/audit', label: 'Audit trail', icon: '◶' },
];

const ALL_NAV = [...CAMPUS_NAV, ...ADMIN_NAV];

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div>
      <div className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent-hover)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
              }`
            }
          >
            <span className="text-base w-5 text-center shrink-0">{n.icon}</span>
            <span className="truncate">{n.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export function Layout() {
  const location = useLocation();
  const { student, loading } = useStudent();
  const [health, setHealth] = useState<string>('…');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    api.health().then(h => setHealth(h.status)).catch(() => setHealth('offline'));
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = ALL_NAV.find(n => location.pathname === n.to)
    ?? ALL_NAV.find(n => location.pathname.startsWith(n.to));
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="flex min-h-dvh">
      <aside
        className={`fixed top-0 left-0 z-40 h-dvh flex flex-col bg-[var(--color-surface-1)] border-r border-[var(--color-border)] transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-[var(--color-border)] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-sm shrink-0">
            In
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in min-w-0">
              <div className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">InCIT</div>
              <div className="text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase truncate">Campus & scheduler</div>
            </div>
          )}
        </div>

        <nav className="flex-1 py-1 px-2 overflow-y-auto">
          <NavSection title="My campus" items={CAMPUS_NAV} />
          <div className="my-3 border-t border-[var(--color-border-subtle)]" />
          <NavSection title="Administration" items={ADMIN_NAV} />
        </nav>

        <div className="px-2 py-3 border-t border-[var(--color-border)] space-y-2 shrink-0">
          <button
            onClick={() => setSwitcherOpen(true)}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors text-left"
            title="Switch student profile"
          >
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-cyan)] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {loading ? '…' : student?.initials ?? '?'}
            </span>
            {sidebarOpen && (
              <span className="min-w-0">
                <span className="block text-xs font-medium text-[var(--color-text-primary)] truncate">
                  {student?.name ?? 'Loading profile'}
                </span>
                <span className="block text-[10px] text-[var(--color-text-muted)] truncate">
                  {student ? `${student.roll} · ${student.semester_label}` : 'Demo profile'}
                </span>
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 px-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${health === 'ok' ? 'bg-[var(--color-success)] animate-pulse-dot' : 'bg-[var(--color-danger)]'}`} />
            {sidebarOpen && (
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {health === 'ok' ? 'API connected' : 'API offline'}
              </span>
            )}
          </div>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center py-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors text-xs"
          >
            {sidebarOpen ? '‹‹ Collapse' : '››'}
          </button>
        </div>
      </aside>

      <main className={`min-w-0 transition-all duration-300 ${sidebarOpen ? 'ml-60 w-[calc(100%-15rem)]' : 'ml-16 w-[calc(100%-4rem)]'}`}>
        <header className="sticky top-0 z-30 h-14 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl flex items-center gap-3 px-6">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)] tracking-tight">
            {current?.label ?? 'InCIT'}
          </h1>
          <span className="hidden md:inline text-[11px] text-[var(--color-text-muted)]">
            {today}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] transition-colors"
            >
              <span>⌕</span>
              <span className="hidden sm:inline">Search or jump to</span>
              <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)]">⌘K</kbd>
            </button>
            <span className="hidden lg:inline text-[11px] text-[var(--color-text-muted)]">Zephyr Hackathon • CrunchWeek</span>
          </div>
        </header>

        <div className="p-6">
          <Outlet />
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <StudentSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </div>
  );
}
