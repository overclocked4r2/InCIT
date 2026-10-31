import { useState, useEffect } from 'react';
import { api } from '../api';
import type { FestWeekResponse, BookingDecision } from '../types';
import { Card, Button, Badge, Spinner, EmptyState } from '../components/ui';

export function SpectraWeekPage() {
  const [data, setData] = useState<FestWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const load = () => {
    setLoading(true);
    api.festWeek()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const reprocess = async () => {
    setReprocessing(true);
    setError('');
    try {
      await api.reprocessFestWeek();
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setReprocessing(false);
    }
  };

  const bookings = data?.fest_week?.bookings ?? [];
  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  const counts = {
    approved: bookings.filter(b => b.status === 'approved').length,
    rejected: bookings.filter(b => b.status === 'rejected').length,
    alternative: bookings.filter(b => b.status === 'alternative_offered').length,
  };

  const statusBadge = (s: string) => {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
      approved: 'success',
      alternative_offered: 'warning',
      rejected: 'danger',
    };
    return <Badge variant={map[s] ?? 'default'}>{s.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="glass p-5 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-bold tracking-tight">Spectra Week Bookings</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Fest-week booking decisions — processed with priority ordering and role-category caps
          </p>
        </div>
        <Button onClick={reprocess} loading={reprocessing} variant="primary">
          ↻ Reprocess
        </Button>
      </div>

      {error && (
        <Card className="border-[var(--color-danger)]!">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="text-center cursor-pointer hover:border-[var(--color-success)]! transition-colors" onClick={() => setFilter(filter === 'approved' ? 'all' : 'approved')}>
          <div className="text-2xl font-bold text-[var(--color-success)]">{counts.approved}</div>
          <div className="text-xs text-[var(--color-text-muted)]">Approved</div>
        </Card>
        <Card className="text-center cursor-pointer hover:border-[var(--color-warning)]! transition-colors" onClick={() => setFilter(filter === 'alternative_offered' ? 'all' : 'alternative_offered')}>
          <div className="text-2xl font-bold text-[var(--color-warning)]">{counts.alternative}</div>
          <div className="text-xs text-[var(--color-text-muted)]">Alternatives</div>
        </Card>
        <Card className="text-center cursor-pointer hover:border-[var(--color-danger)]! transition-colors" onClick={() => setFilter(filter === 'rejected' ? 'all' : 'rejected')}>
          <div className="text-2xl font-bold text-[var(--color-danger)]">{counts.rejected}</div>
          <div className="text-xs text-[var(--color-text-muted)]">Rejected</div>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex max-w-full gap-1 overflow-x-auto bg-[var(--color-surface-1)] p-1 rounded-lg border border-[var(--color-border)]">
        {['all', 'approved', 'alternative_offered', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === f
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Decisions list */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Spinner size={28} /></div>
      ) : data?.status === 'not_processed' || bookings.length === 0 ? (
        <EmptyState
          icon="★"
          title="No booking decisions yet"
          sub="Generate a timetable first, then booking requests will be auto-processed."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((b, i) => (
            <div
              key={b.request_id ?? i}
              className="glass p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 hover:border-[var(--color-accent)]!/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{b.request_id}</span>
                  {statusBadge(b.status)}
                </div>
                {b.day && b.start_period != null && (
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {b.day} P{b.start_period}–P{b.end_period} • Room: {b.room_id}
                  </div>
                )}
                {b.reason && (
                  <div className="text-xs text-[var(--color-text-muted)] mt-1 italic">
                    {b.reason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
