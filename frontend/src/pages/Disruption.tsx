import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Room, Faculty, RescheduleHistoryEntry, TimetableResponse } from '../types';
import { Card, Button, Select, Spinner, EmptyState } from '../components/ui';
import { DAYS, PERIODS } from '../types';

type ProposalChange = {
  session_id: string;
  old: { day: string; start_period: number; room_id: string };
  new: { day: string; start_period: number; room_id: string };
  reason: string;
};

type ProposalEntry = RescheduleHistoryEntry & {
  id?: string;
  old?: ProposalChange['old'];
  new?: ProposalChange['new'];
  changes?: ProposalChange[];
  decided_by?: string;
  comments?: string;
};

export function DisruptionPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [timetable, setTimetable] = useState<TimetableResponse | null>(null);
  const [rescheduleHistory, setRescheduleHistory] = useState<RescheduleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  /* Disruption form */
  const [disType, setDisType] = useState('room_unavailable');
  const [disRoomId, setDisRoomId] = useState('');
  const [disFacultyId, setDisFacultyId] = useState('');
  const [disDays, setDisDays] = useState<string[]>([]);
  const [disPeriods, setDisPeriods] = useState<number[]>([]);
  const [disReason, setDisReason] = useState('');
  const [applying, setApplying] = useState(false);
  const [resolving, setResolving] = useState(false);

  /* Reschedule form */
  const [rescSessionId, setRescSessionId] = useState('');
  const [rescDay, setRescDay] = useState('');
  const [rescPeriod, setRescPeriod] = useState(1);
  const [rescRoom, setRescRoom] = useState('');
  const [rescReason, setRescReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [decidingId, setDecidingId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [r, f, tt, hist] = await Promise.all([
        api.rooms(),
        api.faculty(),
        api.timetable(),
        api.rescheduleHistory(),
      ]);
      setRooms(r);
      setFaculty(f);
      setTimetable(tt);
      setRescheduleHistory(hist);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* Apply disruption */
  const applyDisruption = async () => {
    setApplying(true);
    setError('');
    setSuccessMsg('');
    try {
      const change: Record<string, unknown> = {
        type: disType,
        days: disDays,
        periods: disPeriods,
        reason: disReason,
      };
      if (disType === 'room_unavailable') change.room_id = disRoomId;
      else change.faculty_id = disFacultyId;

      const res = await api.applyDisruption([change as any]);
      setSuccessMsg(res.message);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  /* Re-solve after disruption */
  const reSolve = async () => {
    setResolving(true);
    setError('');
    try {
      const res = await api.generateTimetable(120);
      setSuccessMsg(`Re-solved: ${res.status} — ${res.assignments.length} sessions`);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setResolving(false);
    }
  };

  /* Clear disruption */
  const clearDisruption = async () => {
    try {
      await api.clearDisruption();
      setSuccessMsg('Disruption cleared');
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  /* Submit reschedule */
  const submitReschedule = async () => {
    if (!rescSessionId || !rescDay || !rescRoom) return;
    setRescheduling(true);
    setError('');
    try {
      const res = await api.reschedule({
        session_id: rescSessionId,
        new_day: rescDay,
        new_start_period: rescPeriod,
        new_room_id: rescRoom,
        reason: rescReason,
      });
      if (res.success) {
        setSuccessMsg(res.message);
      } else {
        setError(`${res.message}\nConflicts: ${res.conflicts.join('; ')}`);
      }
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setRescheduling(false);
    }
  };

  const decideReschedule = async (requestId: string, decision: 'approved' | 'rejected') => {
    setDecidingId(requestId);
    setError('');
    try {
      const res = await api.decideReschedule(requestId, decision);
      setSuccessMsg(res.message);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setDecidingId('');
    }
  };

  const toggleDay = (d: string) =>
    setDisDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const togglePeriod = (p: number) =>
    setDisPeriods(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size={28} /></div>;

  return (
    <div className="space-y-6 animate-fade-up">
      {error && (
        <Card className="border-[var(--color-danger)]!">
          <pre className="text-sm text-[var(--color-danger)] whitespace-pre-wrap">{error}</pre>
        </Card>
      )}
      {successMsg && (
        <Card className="border-[var(--color-success)]!">
          <p className="text-sm text-[var(--color-success)]">✓ {successMsg}</p>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {/* ── Disruption Panel ── */}
        <Card>
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <span className="text-[var(--color-danger)]">⚡</span>
            Apply Disruption
          </h3>

          <div className="space-y-4">
            {/* Type */}
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Disruption Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDisType('room_unavailable')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${disType === 'room_unavailable' ? 'bg-[var(--color-accent-dim)] border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'}`}
                >
                  Room Unavailable
                </button>
                <button
                  onClick={() => setDisType('faculty_unavailable')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${disType === 'faculty_unavailable' ? 'bg-[var(--color-accent-dim)] border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'}`}
                >
                  Faculty Unavailable
                </button>
              </div>
            </div>

            {/* Target */}
            {disType === 'room_unavailable' ? (
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Room</label>
                <Select value={disRoomId} onChange={setDisRoomId} placeholder="Select room" options={rooms.map(r => ({ value: r.id, label: r.name }))} />
              </div>
            ) : (
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Faculty</label>
                <Select value={disFacultyId} onChange={setDisFacultyId} placeholder="Select faculty" options={faculty.map(f => ({ value: f.id, label: f.name }))} />
              </div>
            )}

            {/* Days */}
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Days</label>
              <div className="flex gap-1.5">
                {DAYS.map(d => (
                  <button
                    key={d}
                    onClick={() => toggleDay(d)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${disDays.includes(d) ? 'bg-[var(--color-accent-dim)] border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Periods */}
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Periods</label>
              <div className="flex flex-wrap gap-1.5">
                {PERIODS.map(p => (
                  <button
                    key={p}
                    onClick={() => togglePeriod(p)}
                    className={`w-8 h-8 rounded-md text-xs font-medium transition-all border ${disPeriods.includes(p) ? 'bg-[var(--color-accent-dim)] border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Reason</label>
              <input
                type="text"
                value={disReason}
                onChange={e => setDisReason(e.target.value)}
                placeholder="e.g., Maintenance, Medical leave"
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={applyDisruption} loading={applying} variant="danger">
                Apply Disruption
              </Button>
              <Button onClick={reSolve} loading={resolving} variant="primary">
                Re-solve
              </Button>
              <Button onClick={clearDisruption} variant="ghost">
                Clear
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Reschedule Panel ── */}
        <Card>
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <span className="text-[var(--color-warning)]">↻</span>
            Request Reschedule
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Session ID</label>
              <Select
                value={rescSessionId}
                onChange={setRescSessionId}
                placeholder="Select session"
                options={
                  timetable?.assignments.map(a => ({
                    value: a.session_id,
                    label: `${a.session_id} (${a.day} P${a.start_period} → ${a.room_id})`,
                  })) ?? []
                }
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">New Day</label>
                <Select value={rescDay} onChange={setRescDay} placeholder="Day" options={DAYS.map(d => ({ value: d, label: d }))} />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">New Period</label>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={rescPeriod}
                  onChange={e => setRescPeriod(Number(e.target.value))}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">New Room</label>
                <Select value={rescRoom} onChange={setRescRoom} placeholder="Room" options={rooms.map(r => ({ value: r.id, label: r.name }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Reason</label>
              <input
                type="text"
                value={rescReason}
                onChange={e => setRescReason(e.target.value)}
                placeholder="e.g., Faculty conflict, Room change"
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <Button onClick={submitReschedule} loading={rescheduling} variant="primary" disabled={!rescSessionId || !rescDay || !rescRoom}>
              Submit Reschedule
            </Button>
          </div>
        </Card>
      </div>

      {/* Reschedule History */}
      <Card>
        <h3 className="text-sm font-bold mb-4 text-[var(--color-text-secondary)]">Reschedule History</h3>
        {rescheduleHistory.length === 0 ? (
          <EmptyState icon="↻" title="No reschedule requests yet" />
        ) : (
          <div className="space-y-2">
            {rescheduleHistory.map((historyEntry, i) => {
              const h = historyEntry as ProposalEntry;
              const changes = h.changes ?? (h.old && h.new ? [{ session_id: h.session_id, old: h.old, new: h.new, reason: h.reason }] : []);
              return (
                <div key={h.id ?? i} className="p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)] space-y-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${h.status === 'approved' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : h.status === 'pending' ? 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]' : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'}`}>
                      {h.status}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{h.session_id}</span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-2">{h.reason}</span>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">{new Date(h.timestamp).toLocaleTimeString()}</span>
                  </div>
                  {changes.map(change => (
                    <div key={change.session_id} className="text-xs text-[var(--color-text-secondary)] rounded bg-[var(--color-surface)] px-3 py-2">
                      <span className="font-medium">{change.session_id}: </span>
                      {change.old.day} P{change.old.start_period} / {change.old.room_id}
                      <span className="mx-2">→</span>
                      {change.new.day} P{change.new.start_period} / {change.new.room_id}
                      <span className="block mt-1 text-[var(--color-text-muted)]">{change.reason}</span>
                    </div>
                  ))}
                  {h.conflicts && h.conflicts.length > 0 && (
                    <div className="text-xs text-[var(--color-danger)]">{h.conflicts.join('; ')}</div>
                  )}
                  {h.status === 'pending' && h.id && (
                    <div className="flex gap-2 pt-1">
                      <Button onClick={() => decideReschedule(h.id!, 'approved')} loading={decidingId === h.id} variant="primary">Approve (Admin)</Button>
                      <Button onClick={() => decideReschedule(h.id!, 'rejected')} loading={decidingId === h.id} variant="danger">Reject</Button>
                    </div>
                  )}
                  {h.decided_by && <div className="text-xs text-[var(--color-text-muted)]">Decided by {h.decided_by}</div>}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
