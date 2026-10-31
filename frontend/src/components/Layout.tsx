import { useEffect, useRef, useState } from 'react';
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

const PALETTES = [
  { id: 'indigo', label: 'Indigo Aurora', dark: '#7c83ff', light: '#4f46e5', secondary: '#34d3c0' },
  { id: 'emerald', label: 'Emerald Ink', dark: '#2dd4a7', light: '#0f9d7a', secondary: '#5eead4' },
  { id: 'violet', label: 'Violet & Gold', dark: '#a78bfa', light: '#7c3aed', secondary: '#f5c86b' },
  { id: 'ocean', label: 'Ocean & Amber', dark: '#3b9eff', light: '#1d6fd8', secondary: '#ffb547' },
] as const;

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

function NavSection({ title, items, collapsed }: { title: string; items: NavItem[]; collapsed: boolean }) {
  return (
    <div>
      <div className={`${collapsed ? 'sr-only' : 'px-3 pb-1.5 pt-3'} text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]`}>
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            aria-label={n.label}
            title={collapsed ? n.label : undefined}
            className={({ isActive }) =>
              `flex items-center ${collapsed ? 'justify-center px-1' : 'gap-3 px-3'} py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent-hover)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
              }`
            }
          >
            <span className="text-base w-5 text-center shrink-0">{n.icon}</span>
            {!collapsed && <span className="min-w-0 truncate">{n.label}</span>}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export function Layout({ user, onLogout }: LayoutProps) {
  const location = useLocation();
  const [health, setHealth] = useState<string>('…');
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('incit_sidebar_open');
      if (saved !== null) return saved === 'true';
    } catch {
      // Use the width-based default when browser storage is unavailable.
    }
    return window.innerWidth >= 1280;
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const appearanceRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  );
  const [palette, setPalette] = useState<(typeof PALETTES)[number]['id']>(() => {
    const current = PALETTES.find(option => option.id === document.documentElement.dataset.palette);
    return current?.id ?? 'indigo';
  });
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

  useEffect(() => {
    if (!appearanceOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!appearanceRef.current?.contains(event.target as Node)) setAppearanceOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAppearanceOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [appearanceOpen]);

  const current = ADMIN_NAV.find(n => location.pathname === n.to)
    ?? ADMIN_NAV.find(n => location.pathname.startsWith(n.to));
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const chooseTheme = (nextTheme: 'dark' | 'light') => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem('incit_theme', nextTheme);
    } catch {
      // The theme still changes for this session when browser storage is unavailable.
    }
  };

  const choosePalette = (nextPalette: (typeof PALETTES)[number]['id']) => {
    setPalette(nextPalette);
    document.documentElement.dataset.palette = nextPalette;
    try {
      localStorage.setItem('incit_palette', nextPalette);
    } catch {
      // The palette still changes for this session when browser storage is unavailable.
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(open => {
      const next = !open;
      try {
        localStorage.setItem('incit_sidebar_open', String(next));
      } catch {
        // The sidebar still toggles for this session when browser storage is unavailable.
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-dvh">
      <aside
        className={`spatial-sidebar fixed top-0 left-0 z-40 hidden h-dvh flex-col overflow-hidden bg-[var(--color-surface-1)] border-r border-[var(--color-border)] transition-[width] duration-200 ease-out lg:flex ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        <div className={`flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-0'} h-16 border-b border-[var(--color-border)] shrink-0`}>
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

        <nav className={`flex-1 py-1 overflow-y-auto ${sidebarOpen ? 'px-2' : 'px-1.5'}`}>
          <NavSection title="Scheduling" items={navItems} collapsed={!sidebarOpen} />
        </nav>

        <div className="px-2 py-3 border-t border-[var(--color-border)] space-y-2 shrink-0">
          <div className="flex items-center gap-2 px-2">
            <span title={health === 'ok' ? 'API connected' : 'API offline'} className={`w-2 h-2 rounded-full shrink-0 ${health === 'ok' ? 'bg-[var(--color-success)] animate-pulse-dot' : 'bg-[var(--color-danger)]'}`} />
            {sidebarOpen && (
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {health === 'ok' ? 'API connected' : 'API offline'}
              </span>
            )}
          </div>

          <button
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors text-sm"
          >
            <span aria-hidden="true">{sidebarOpen ? '‹' : '›'}</span>
          </button>
        </div>
      </aside>

      <main className={`spatial-stage min-w-0 w-full transition-[margin,width] duration-200 ease-out ${sidebarOpen ? 'lg:ml-60 lg:w-[calc(100%-15rem)]' : 'lg:ml-16 lg:w-[calc(100%-4rem)]'}`}>
        <header className="sticky top-0 z-30 h-14 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl flex items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <h1 className="hidden sm:block shrink-0 text-sm font-semibold text-[var(--color-text-primary)] tracking-tight">
            {current?.label ?? 'InCIT'}
          </h1>
          <span className="hidden md:inline text-[11px] text-[var(--color-text-muted)]">
            {today}
          </span>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="appearance-control" ref={appearanceRef}>
              <button
                type="button"
                onClick={() => setAppearanceOpen(open => !open)}
                aria-haspopup="dialog"
                aria-expanded={appearanceOpen}
                aria-controls="incit-appearance-panel"
                aria-label="Appearance settings"
                title="Appearance settings"
                className="appearance-trigger"
              >
                <span className="appearance-trigger-swatch" style={{ background: `linear-gradient(135deg, ${PALETTES.find(option => option.id === palette)?.[theme] ?? '#4f46e5'}, ${PALETTES.find(option => option.id === palette)?.secondary ?? '#34d3c0'})` }} />
                <span className="hidden sm:inline">Appearance</span>
                <span aria-hidden="true" className="text-[10px]">⌄</span>
              </button>
              {appearanceOpen && (
                <div id="incit-appearance-panel" role="dialog" aria-label="Appearance settings" className="appearance-panel animate-fade-up">
                  <div>
                    <div className="appearance-label">Theme</div>
                    <div className="appearance-mode-group" role="group" aria-label="Choose light or dark theme">
                      <button type="button" onClick={() => chooseTheme('dark')} aria-pressed={theme === 'dark'} className={`appearance-mode ${theme === 'dark' ? 'appearance-selected' : ''}`}>
                        <span aria-hidden="true">◐</span> Midnight
                      </button>
                      <button type="button" onClick={() => chooseTheme('light')} aria-pressed={theme === 'light'} className={`appearance-mode ${theme === 'light' ? 'appearance-selected' : ''}`}>
                        <span aria-hidden="true">☼</span> Porcelain
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="appearance-label">Palette</div>
                    <div className="palette-grid" role="group" aria-label="Choose color palette">
                      {PALETTES.map(option => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => choosePalette(option.id)}
                          aria-label={option.label}
                          aria-pressed={palette === option.id}
                          className={`palette-choice ${palette === option.id ? 'appearance-selected' : ''}`}
                        >
                          <span aria-hidden="true" className="palette-swatch" style={{ background: `linear-gradient(135deg, ${option[theme]}, ${option.secondary})` }} />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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

        <nav aria-label="Main navigation" className="sticky top-14 z-20 flex gap-1 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 lg:hidden">
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
