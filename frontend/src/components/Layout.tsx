import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api';
import type { DemoUser } from '../api';
import { CommandPalette } from './CommandPalette';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface LayoutProps {
  user: DemoUser;
  onLogout: () => void;
}

const ADMIN_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: '⚙' },
  { to: '/timetable', label: 'Solver & timetable', icon: '▶' },
  { to: '/exams', label: 'Exam schedule', icon: '◇' },
  { to: '/spectra', label: 'Spectra Week', icon: '✹' },
  { to: '/booking', label: 'NL booking', icon: '✎' },
  { to: '/disruption', label: 'Disruptions', icon: '⚡' },
  { to: '/audit', label: 'Audit trail', icon: '◶' },
];

const ROLE_NAV: Record<string, NavItem[]> = {
  admin: ADMIN_NAV,
  department_coordinator: ADMIN_NAV.filter(item => !['/audit'].includes(item.to)),
  faculty: ADMIN_NAV.filter(item => ['/dashboard', '/timetable', '/booking'].includes(item.to)),
  club_representative: ADMIN_NAV.filter(item => ['/dashboard', '/timetable', '/booking', '/spectra'].includes(item.to)),
};

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

export function Layout({ user, onLogout }: LayoutProps) {
  const location = useLocation();
  const [health, setHealth] = useState<string>('…');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<'midnight' | 'porcelain'>(() =>
    document.documentElement.dataset.theme === 'porcelain' ? 'porcelain' : 'midnight',
  );
  const navItems = ROLE_NAV[user.role] ?? ROLE_NAV.faculty;

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

  const current = ADMIN_NAV.find(n => location.pathname === n.to)
    ?? ADMIN_NAV.find(n => location.pathname.startsWith(n.to));
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const chooseTheme = (nextTheme: 'midnight' | 'porcelain') => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem('incit_theme', nextTheme);
    } catch {
      // The theme still changes for this session when browser storage is unavailable.
    }
  };

  return (
    <div className="flex min-h-dvh">
      <aside
        className={`fixed top-0 left-0 z-40 hidden h-dvh flex-col bg-[var(--color-surface-1)] border-r border-[var(--color-border)] transition-all duration-300 ease-in-out md:flex ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-[var(--color-border)] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-[var(--color-on-accent)] font-bold text-sm shrink-0">
            In
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in min-w-0">
              <div className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">InCIT</div>
              <div className="text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase truncate">Institutional scheduler</div>
            </div>
          )}
        </div>

        <nav className="flex-1 py-1 px-2 overflow-y-auto">
          <NavSection title="Scheduling" items={navItems} />
        </nav>

        <div className="px-2 py-3 border-t border-[var(--color-border)] space-y-2 shrink-0">
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

      <main className={`min-w-0 w-full transition-all duration-300 ${sidebarOpen ? 'md:ml-60 md:w-[calc(100%-15rem)]' : 'md:ml-16 md:w-[calc(100%-4rem)]'}`}>
        <header className="sticky top-0 z-30 h-14 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl flex items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <h1 className="hidden sm:block shrink-0 text-sm font-semibold text-[var(--color-text-primary)] tracking-tight">
            {current?.label ?? 'InCIT'}
          </h1>
          <span className="hidden md:inline text-[11px] text-[var(--color-text-muted)]">
            {today}
          </span>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="theme-switch" role="group" aria-label="Color theme">
              <button
                type="button"
                onClick={() => chooseTheme('midnight')}
                aria-label="Midnight theme"
                aria-pressed={theme === 'midnight'}
                title="Midnight Tide theme"
                className={`theme-option ${theme === 'midnight' ? 'theme-option-active' : ''}`}
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path d="M16.6 12.3A7.1 7.1 0 0 1 7.7 3.4a7.2 7.2 0 1 0 8.9 8.9Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m13.8 3 .4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4.4-1.2Z" fill="currentColor" />
                </svg>
                <span className="hidden 2xl:inline">Midnight</span>
              </button>
              <button
                type="button"
                onClick={() => chooseTheme('porcelain')}
                aria-label="Porcelain theme"
                aria-pressed={theme === 'porcelain'}
                title="Porcelain theme"
                className={`theme-option ${theme === 'porcelain' ? 'theme-option-active' : ''}`}
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <circle cx="10" cy="10" r="3.3" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M10 1.8v2M10 16.2v2M18.2 10h-2M3.8 10h-2m14-5.8-1.4 1.4M5.6 14.4l-1.4 1.4m11.6 0-1.4-1.4M5.6 5.6 4.2 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="hidden 2xl:inline">Porcelain</span>
              </button>
            </div>
            <button
              onClick={() => setPaletteOpen(true)}
              className="shrink-0 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] transition-colors"
            >
              <span>⌕</span>
              <span className="hidden sm:inline">Search or jump to</span>
              <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)]">⌘K</kbd>
            </button>
            <span className="hidden lg:inline text-[11px] text-[var(--color-text-muted)]">Zephyr Hackathon • CrunchWeek</span>
            <div className="flex min-w-0 shrink-0 items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <span className="max-w-28 truncate sm:max-w-40">{user.name} · {user.role.replace('_', ' ')}</span>
              <button onClick={onLogout} className="shrink-0 rounded border border-[var(--color-border)] px-2 py-1 hover:text-[var(--color-text-primary)]">Sign out</button>
            </div>
          </div>
        </header>

        <nav className="sticky top-14 z-20 flex gap-1 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 md:hidden">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `shrink-0 rounded-md px-2.5 py-1.5 text-xs ${isActive ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent-hover)]' : 'text-[var(--color-text-secondary)]'}`}
            >
              {item.icon} {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
