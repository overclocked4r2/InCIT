import { useState, useEffect } from 'react';
import { api } from '../api';
import type { DashboardStats } from '../types';
import { StatCard, Card, Button, Badge, Spinner } from '../components/ui';

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.dashboard()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={32} />
    </div>
  );

  if (error) return (
    <Card className="border-[var(--color-danger)]!">
      <p className="text-sm text-[var(--color-danger)]">Failed to load dashboard: {error}</p>
      <Button onClick={load} variant="secondary" className="mt-3">Retry</Button>
    </Card>
  );

  if (!stats) return null;

  const statusColor = {
    not_generated: 'danger',
    draft: 'warning',
    published: 'success',
    archived: 'info',
  } as const;
  const sc = statusColor[stats.timetable_status as keyof typeof statusColor] ?? 'info';

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Hero status */}
      <div className="glass p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-bold tracking-tight">System Overview</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            InCIT Institutional Scheduling — real-time status
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={sc as 'success' | 'warning' | 'danger' | 'info'}>
            {stats.timetable_status.replace('_', ' ').toUpperCase()}
          </Badge>
          {stats.solver_status && (
            <Badge variant={stats.solver_status === 'optimal' ? 'success' : 'warning'}>
              Solver: {stats.solver_status}
            </Badge>
          )}
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
        <StatCard label="Total Sessions" value={stats.total_sessions} accent="accent" />
        <StatCard
          label="Scheduled"
          value={stats.scheduled_sessions}
          sub={stats.total_sessions > 0 ? `${Math.round(stats.scheduled_sessions / stats.total_sessions * 100)}% coverage` : undefined}
          accent="success"
        />
        <StatCard label="Rooms" value={stats.total_rooms} accent="cyan" />
        <StatCard label="Faculty" value={stats.total_faculty} accent="info" />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
        <StatCard label="Student Groups" value={stats.total_groups} accent="accent" />
        <StatCard label="Booking Requests" value={stats.total_booking_requests} accent="warning" />
        <StatCard label="Total Exams" value={stats.total_exams} accent="info" />
        <StatCard label="Exams Scheduled" value={stats.scheduled_exams} accent="success" />
      </div>

      {/* Booking decisions & Validation */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Bookings breakdown */}
        <Card>
          <h3 className="text-sm font-semibold mb-4 text-[var(--color-text-secondary)]">Fest Week Bookings</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-muted)]">Approved</span>
              <span className="text-sm font-semibold text-[var(--color-success)]">{stats.approved_bookings}</span>
            </div>
            <div className="w-full bg-[var(--color-surface-3)] rounded-full h-1.5">
              <div
                className="bg-[var(--color-success)] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${stats.total_booking_requests > 0 ? (stats.approved_bookings / stats.total_booking_requests) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-muted)]">Alternatives</span>
              <span className="text-sm font-semibold text-[var(--color-warning)]">{stats.alternative_bookings}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-muted)]">Rejected</span>
              <span className="text-sm font-semibold text-[var(--color-danger)]">{stats.rejected_bookings}</span>
            </div>
          </div>
        </Card>

        {/* Validation */}
        <Card>
          <h3 className="text-sm font-semibold mb-4 text-[var(--color-text-secondary)]">Validation Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-muted)]">Hard Violations</span>
              <Badge variant={stats.hard_violations === 0 ? 'success' : 'danger'}>
                {stats.hard_violations}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-muted)]">Soft Penalty</span>
              <span className="text-sm font-mono text-[var(--color-text-secondary)]">{stats.soft_penalty}</span>
            </div>
            {stats.hard_violations === 0 && stats.scheduled_sessions > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-success-dim)]">
                <span className="text-[var(--color-success)]">✓</span>
                <span className="text-xs text-[var(--color-success)]">Schedule passes all hard constraints</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <h3 className="text-sm font-semibold mb-4 text-[var(--color-text-secondary)]">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.location.href = '/timetable'} variant="secondary">
            View Timetable
          </Button>
          <Button onClick={() => window.location.href = '/booking'} variant="secondary">
            NL Booking
          </Button>
          <Button onClick={() => window.location.href = '/spectra'} variant="secondary">
            Spectra Week
          </Button>
          <Button onClick={() => window.location.href = '/disruption'} variant="secondary">
            Disruptions
          </Button>
        </div>
      </Card>
    </div>
  );
}
