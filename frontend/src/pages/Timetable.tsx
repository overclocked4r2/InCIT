import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api';
import type { TimetableAssignment, TimetableResponse, Room, Faculty, StudentGroup } from '../types';
import { Card, Button, Badge, Select, Spinner, EmptyState } from '../components/ui';
import { DAYS, PERIODS } from '../types';

/* ── Color palette for session kinds ── */
const KIND_COLORS: Record<string, string> = {
  lecture: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
  tutorial: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  lab: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  seminar: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
};

export function TimetablePage() {
  const [tt, setTt] = useState<TimetableResponse | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [solving, setSolving] = useState(false);
  const [solveMsg, setSolveMsg] = useState('');
  const [error, setError] = useState('');
  const [timeLimit, setTimeLimit] = useState(120);

  /* Filters */
  const [filterDay, setFilterDay] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r, f, g] = await Promise.all([
        api.timetable({ day: filterDay || undefined, room_id: filterRoom || undefined, faculty_id: filterFaculty || undefined, group_id: filterGroup || undefined }),
        api.rooms(),
        api.faculty(),
        api.studentGroups(),
      ]);
      setTt(t);
      setRooms(r);
      setFaculty(f);
      setGroups(g);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filterDay, filterRoom, filterFaculty, filterGroup]);

  useEffect(() => { loadData(); }, [loadData]);

  /* Run solver */
  const runSolver = async () => {
    setSolving(true);
    setSolveMsg('');
    setError('');
    try {
      const res = await api.generateTimetable(timeLimit);
      setSolveMsg(`Solver finished: ${res.status} — ${res.assignments.length} sessions assigned`);
      await loadData();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSolving(false);
    }
  };

  /* Publish / Archive */
  const publish = async () => {
    try {
      await api.publishTimetable();
      await loadData();
    } catch (e: unknown) { setError((e as Error).message); }
  };
  const archive = async () => {
    try {
      await api.archiveTimetable();
      await loadData();
    } catch (e: unknown) { setError((e as Error).message); }
  };

  /* Build grid: grid[day][period] = TimetableAssignment[] */
  const grid = useMemo(() => {
    const m: Record<string, Record<number, TimetableAssignment[]>> = {};
    for (const d of DAYS) {
      m[d] = {};
      for (const p of PERIODS) m[d][p] = [];
    }
    if (tt) {
      for (const a of tt.assignments) {
        const dur = a.duration ?? 1;
        for (let p = a.start_period; p < a.start_period + dur; p++) {
          if (m[a.day]?.[p]) m[a.day][p].push(a);
        }
      }
    }
    return m;
  }, [tt]);

  /* Room utilization */
  const utilization = useMemo(() => {
    if (!tt || tt.total_assignments === 0) return 0;
    const totalSlots = rooms.length * DAYS.length * PERIODS.length;
    if (totalSlots === 0) return 0;
    let used = 0;
    for (const a of tt.assignments) used += (a.duration ?? 1);
    return Math.round((used / totalSlots) * 100);
  }, [tt, rooms]);

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Controls bar */}
      <div className="glass p-4 flex flex-col lg:flex-row items-start lg:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-bold tracking-tight">Timetable Management</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {tt ? `${tt.total_assignments} sessions • v${tt.version} • ${tt.status}` : 'No timetable generated'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time limit */}
          <div className="flex items-center gap-1.5 text-xs">
            <label className="text-[var(--color-text-muted)]">Limit:</label>
            <input
              type="number"
              min={10}
              max={600}
              value={timeLimit}
              onChange={e => setTimeLimit(Number(e.target.value))}
              className="w-16 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            <span className="text-[var(--color-text-muted)]">s</span>
          </div>

          <Button onClick={runSolver} loading={solving} variant="primary">
            {solving ? 'Solving…' : '▶ Run Solver'}
          </Button>
          <Button onClick={publish} variant="secondary" disabled={tt?.status !== 'draft'}>
            Publish
          </Button>
          <Button onClick={archive} variant="ghost" disabled={!tt || (tt.status !== 'draft' && tt.status !== 'published')}>
            Archive
          </Button>
        </div>
      </div>

      {solveMsg && (
        <div className="glass p-3 border-[var(--color-success)]! text-sm text-[var(--color-success)]">
          ✓ {solveMsg}
        </div>
      )}
      {error && (
        <div className="glass p-3 border-[var(--color-danger)]! text-sm text-[var(--color-danger)]">
          ✕ {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={filterDay}
          onChange={setFilterDay}
          placeholder="All Days"
          options={DAYS.map(d => ({ value: d, label: d }))}
        />
        <Select
          value={filterRoom}
          onChange={setFilterRoom}
          placeholder="All Rooms"
          options={rooms.map(r => ({ value: r.id, label: `${r.name} (${r.capacity})` }))}
        />
        <Select
          value={filterFaculty}
          onChange={setFilterFaculty}
          placeholder="All Faculty"
          options={faculty.map(f => ({ value: f.id, label: f.name }))}
        />
        <Select
          value={filterGroup}
          onChange={setFilterGroup}
          placeholder="All Groups"
          options={groups.map(g => ({ value: g.id, label: g.name }))}
        />
        {(filterDay || filterRoom || filterFaculty || filterGroup) && (
          <Button variant="ghost" onClick={() => { setFilterDay(''); setFilterRoom(''); setFilterFaculty(''); setFilterGroup(''); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Room utilization bar */}
      {tt && tt.total_assignments > 0 && (
        <Card className="!p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[var(--color-text-muted)]">Room Utilization</span>
            <span className="text-xs font-mono text-[var(--color-text-secondary)]">{utilization}%</span>
          </div>
          <div className="w-full bg-[var(--color-surface-3)] rounded-full h-2">
            <div
              className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-cyan)] h-2 rounded-full transition-all duration-700"
              style={{ width: `${utilization}%` }}
            />
          </div>
        </Card>
      )}

      {/* Timetable Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Spinner size={28} /></div>
      ) : !tt || tt.total_assignments === 0 ? (
        <EmptyState
          icon="▦"
          title="No timetable generated yet"
          sub="Click 'Run Solver' to generate an optimal schedule for all 189 sessions."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="p-2 text-left text-[var(--color-text-muted)] font-medium border-b border-[var(--color-border)] w-20">Period</th>
                {DAYS.map(d => (
                  <th key={d} className="p-2 text-center text-[var(--color-text-muted)] font-medium border-b border-[var(--color-border)]">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(p => (
                <tr key={p}>
                  <td className="p-2 text-[var(--color-text-muted)] font-mono border-b border-[var(--color-border-subtle)] align-top">
                    P{p}
                  </td>
                  {DAYS.map(d => {
                    const cells = grid[d]?.[p] ?? [];
                    return (
                      <td key={d} className="p-1 border-b border-[var(--color-border-subtle)] align-top min-w-[140px]">
                        <div className="space-y-1">
                          {cells.map(a => {
                            const kindCls = KIND_COLORS[a.kind ?? ''] ?? 'bg-[var(--color-surface-3)] border-[var(--color-border)] text-[var(--color-text-secondary)]';
                            return (
                              <div
                                key={`${a.session_id}-${p}`}
                                className={`slot-cell rounded-md border px-2 py-1.5 ${kindCls} cursor-default`}
                                title={`${a.session_id}\nRoom: ${a.room_name ?? a.room_id}\nFaculty: ${a.faculty_id}\nGroups: ${a.groups?.join(', ')}`}
                              >
                                <div className="font-semibold truncate">{a.course_id ?? a.session_id}</div>
                                <div className="opacity-70 truncate">{a.room_name ?? a.room_id}</div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {tt && tt.total_assignments > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)]">
          {Object.entries(KIND_COLORS).map(([kind, cls]) => (
            <div key={kind} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded border ${cls}`} />
              {kind}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
