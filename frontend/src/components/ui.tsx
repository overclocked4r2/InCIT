import type { ReactNode } from 'react';

function trackCardPointer(event: React.PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const element = event.currentTarget;
  const bounds = element.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  const tiltX = (0.5 - y) * 5;
  const tiltY = (x - 0.5) * 5;
  element.style.setProperty('--card-tilt-x', `${tiltX}deg`);
  element.style.setProperty('--card-tilt-y', `${tiltY}deg`);
  element.style.transform = `perspective(1100px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(5px) translateY(-1px)`;
}

function resetCardPointer(event: React.PointerEvent<HTMLDivElement>) {
  event.currentTarget.style.setProperty('--card-tilt-x', '0deg');
  event.currentTarget.style.setProperty('--card-tilt-y', '0deg');
  event.currentTarget.style.removeProperty('transform');
}

/* ── Card ── */
export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`glass spatial-card min-w-0 p-5 ${className}`} onPointerMove={trackCardPointer} onPointerLeave={resetCardPointer} onClick={onClick} role={onClick ? 'button' : undefined}>
      {children}
    </div>
  );
}

/* ── Stat card ── */
export function StatCard({
  label, value, sub, accent = 'accent',
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'cyan';
}) {
  const bg: Record<string, string> = {
    accent: 'bg-[var(--color-accent-dim)]',
    success: 'bg-[var(--color-success-dim)]',
    warning: 'bg-[var(--color-warning-dim)]',
    danger: 'bg-[var(--color-danger-dim)]',
    info: 'bg-[var(--color-info-dim)]',
    cyan: 'bg-[var(--color-cyan-dim)]',
  };
  const text: Record<string, string> = {
    accent: 'text-[var(--color-accent)]',
    success: 'text-[var(--color-success)]',
    warning: 'text-[var(--color-warning)]',
    danger: 'text-[var(--color-danger)]',
    info: 'text-[var(--color-info)]',
    cyan: 'text-[var(--color-cyan)]',
  };
  return (
    <div className="glass spatial-card p-4 flex items-start gap-4" onPointerMove={trackCardPointer} onPointerLeave={resetCardPointer}>
      <div className={`w-10 h-10 rounded-lg ${bg[accent]} flex items-center justify-center shrink-0`}>
        <span className={`text-lg font-bold ${text[accent]}`}>{String(value).slice(0, 3)}</span>
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{value}</div>
        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</div>
        {sub && <div className={`text-xs mt-1 ${text[accent]}`}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Badge ── */
export function Badge({
  children, variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const cls: Record<string, string> = {
    default: 'bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]',
    success: 'bg-[var(--color-success-dim)] text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning-dim)] text-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger-dim)] text-[var(--color-danger)]',
    info: 'bg-[var(--color-info-dim)] text-[var(--color-info)]',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${cls[variant]}`}>
      {children}
    </span>
  );
}

/* ── Button ── */
export function Button({
  children, onClick, variant = 'primary', disabled = false, loading = false, className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary: 'bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] active:scale-[0.98]',
    secondary: 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-4)] border border-[var(--color-border)]',
    danger: 'bg-[var(--color-danger)] text-[var(--color-on-danger)] hover:brightness-110 active:scale-[0.98]',
    ghost: 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]',
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]} ${className}`}>
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin-slow" />}
      {children}
    </button>
  );
}

/* ── Spinner ── */
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg className="animate-spin-slow" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-20" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ── Empty state ── */
export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3 opacity-30">{icon}</div>
      <div className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</div>
      {sub && <div className="text-xs text-[var(--color-text-muted)] mt-1 max-w-xs">{sub}</div>}
    </div>
  );
}

/* ── Page header ── */
export function PageHeader({
  title, sub, actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
      <div className="flex-1 min-w-0">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {sub && <p className="text-xs text-[var(--color-text-muted)] mt-1">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Progress bar ── */
export function ProgressBar({
  value, tone = 'accent', target,
}: {
  value: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'cyan';
  target?: number;
}) {
  const colors: Record<string, string> = {
    accent: 'bg-[var(--color-accent)]',
    success: 'bg-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger)]',
    cyan: 'bg-[var(--color-cyan)]',
  };
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative w-full bg-[var(--color-surface-3)] rounded-full h-2 overflow-visible">
      <div className={`${colors[tone]} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      {target !== undefined && (
        <div
          className="absolute top-[-2px] bottom-[-2px] w-px bg-[var(--color-text-secondary)]/70"
          style={{ left: `${target}%` }}
          title={`${target}% target`}
        />
      )}
    </div>
  );
}

/* ── Progress ring ── */
export function Ring({
  value, size = 104, stroke = 9, label, sub,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 85 ? 'var(--color-success)' : pct >= 75 ? 'var(--color-accent)' : pct >= 65 ? 'var(--color-warning)' : 'var(--color-danger)';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--color-surface-3)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (pct / 100) * circumference}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tracking-tight">{label ?? `${Math.round(pct)}%`}</span>
        {sub && <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sub}</span>}
      </div>
    </div>
  );
}

/* ── Compact metric ── */
export function Metric({
  label, value, sub, tone = 'accent',
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'cyan' | 'info';
}) {
  const colors: Record<string, string> = {
    accent: 'text-[var(--color-accent)]',
    success: 'text-[var(--color-success)]',
    warning: 'text-[var(--color-warning)]',
    danger: 'text-[var(--color-danger)]',
    cyan: 'text-[var(--color-cyan)]',
    info: 'text-[var(--color-info)]',
  };
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
      <div className={`text-lg font-bold tracking-tight mt-1 ${colors[tone]}`}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

/* ── Select ── */
export function Select({
  value, onChange, options, placeholder, className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`min-w-0 max-w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] appearance-none cursor-pointer ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
