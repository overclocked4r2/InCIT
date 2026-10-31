import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { AttendanceCourse, AttendanceResponse } from '../types';
import { useStudent } from '../StudentContext';
import { Badge, Button, Card, EmptyState, PageHeader, ProgressBar, Ring, Spinner } from '../components/ui';

const statusBadge = {
  critical: 'danger',
  watch: 'warning',
  safe: 'success',
  comfortable: 'success',
} as const;

export function AttendancePage() {
  const { studentId } = useStudent();
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [simCourse, setSimCourse] = useState('');
  const [simMode, setSimMode] = useState<'attend' | 'miss'>('attend');
  const [simCount, setSimCount] = useState(3);

  const load = () => {
    setLoading(true);
    api.portalAttendance(studentId)
      .then(d => { setData(d); setError(''); setSimCourse(prev => prev || d.courses[0]?.course_id || ''); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [studentId]);

  const rows = useMemo(() => {
    if (!data) return [];
    return filter === 'attention' ? data.courses.filter(c => c.percent < data.target) : data.courses;
  }, [data, filter]);

  const log = async (course: AttendanceCourse, present: boolean) => {
    setBusy(`${course.course_id}-${present}`);
    setNotice('');
    try {
      const res = await api.portalLogAttendance(studentId, course.course_id, present);
      setData(prev => prev ? {
        ...prev,
        ...res.summary,
        log: [res.entry, ...prev.log].slice(0, 20),
      } : prev);
      setNotice(`Logged ${present ? 'present' : 'absent'} for ${course.course_id}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    if (!window.confirm('Reset attendance for this demo profile to its seeded state?')) return;
    try {
      await api.portalResetAttendance(studentId);
      setNotice('Attendance reset to the seeded demo record.');
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={30} /></div>;
  if (error || !data) {
    return <Card className="border-[var(--color-danger)]!"><p className="text-sm text-[var(--color-danger)]">{error || 'No attendance data.'}</p></Card>;
  }

  const simulated = (() => {
    const course = data.courses.find(c => c.course_id === simCourse);
    if (!course) return null;
    const attended = course.attended + (simMode === 'attend' ? simCount : 0);
    const held = course.held + simCount;
    return { course, projected: held ? Math.round((attended / held) * 1000) / 10 : 0, attended, held };
  })();

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Attendance"
        sub="75% is the institute requirement. Numbers update as you log classes."
        actions={
          <>
            <a
              href={api.portalAttendanceCsvUrl(studentId)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
            >
              ↓ Export CSV
            </a>
            <Button variant="ghost" onClick={reset}>Reset demo</Button>
          </>
        }
      />

      {notice && <div className="rounded-lg border border-[var(--color-success)]/40 bg-[var(--color-success-dim)] px-4 py-2.5 text-xs text-[var(--color-success)]">{notice}</div>}

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-2 flex items-center gap-6">
          <Ring value={data.overall_percent} size={120} label={`${data.overall_percent}%`} sub="Overall" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Semester {data.student.semester} attendance</div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              {data.attended} of {data.held} classes attended across {data.course_count} subjects.
            </p>
            <div className="mt-3">
              <ProgressBar value={data.overall_percent} target={data.target} tone={data.overall_percent >= data.target ? 'success' : 'warning'} />
              <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1">
                <span>0%</span><span>75% target</span><span>100%</span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Badge variant={data.below_target ? 'warning' : 'success'}>{data.below_target} below target</Badge>
              {data.critical > 0 && <Badge variant="danger">{data.critical} critical</Badge>}
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Classes attended</div>
          <div className="text-2xl font-bold mt-1">{data.attended}<span className="text-sm font-normal text-[var(--color-text-muted)]"> / {data.held}</span></div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-2">Manual logs are stored for this demo and survive restarts.</p>
        </Card>

        <Card>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Closest to the line</div>
          {data.watchlist.length === 0 ? (
            <p className="text-xs text-[var(--color-success)] mt-2">All clear — every subject is above 75%.</p>
          ) : (
            <div className="space-y-2 mt-2">
              {data.watchlist.map(c => (
                <div key={c.course_id} className="flex items-center justify-between text-xs">
                  <span className="truncate">{c.course_id}</span>
                  <span className={c.percent < 65 ? 'text-[var(--color-danger)]' : 'text-[var(--color-warning)]'}>{c.percent}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs ${filter === 'all' ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'}`}>All {data.course_count}</button>
        <button onClick={() => setFilter('attention')} className={`px-3 py-1.5 rounded-lg text-xs ${filter === 'attention' ? 'bg-[var(--color-warning-dim)] text-[var(--color-warning)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'}`}>Needs attention {data.below_target}</button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="✓" title="Nothing below 75%" sub="Every subject is above the attendance target." />
      ) : (
        <div className="space-y-2">
          {rows.map(c => (
            <Card key={c.course_id} className="!p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="w-full md:w-64 shrink-0 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--color-text-muted)]">{c.course_id}</span>
                    <Badge variant={statusBadge[c.status]}>{c.status}</Badge>
                  </div>
                  <div className="text-sm font-medium truncate mt-0.5">{c.title}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)] truncate">{c.faculty.join(', ')}</div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-[var(--color-text-muted)]">{c.attended} of {c.held} classes</span>
                    <span className="font-semibold">{c.percent}%</span>
                  </div>
                  <ProgressBar value={c.percent} target={data.target} tone={c.status === 'critical' ? 'danger' : c.status === 'watch' ? 'warning' : 'success'} />
                  <div className="text-[10px] mt-1.5">
                    {c.percent < data.target ? (
                      <span className="text-[var(--color-warning)]">
                        Attend {c.to_reach} more {c.to_reach === 1 ? 'class' : 'classes'} to reach 75%
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">
                        {c.can_miss > 0
                          ? `You can miss ${c.can_miss} ${c.can_miss === 1 ? 'class' : 'classes'} and stay at or above 75%`
                          : 'Right on the 75% line — attend the next class'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="secondary"
                    className="!px-2.5 !py-1.5 !text-xs"
                    loading={busy === `${c.course_id}-true`}
                    onClick={() => log(c, true)}
                  >
                    + Present
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-2.5 !py-1.5 !text-xs"
                    loading={busy === `${c.course_id}-false`}
                    onClick={() => log(c, false)}
                  >
                    − Absent
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold">What-if simulator</h3>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">See how attending or missing the next few classes changes your percentage.</p>
          <div className="grid sm:grid-cols-3 gap-2 mt-4">
            <select
              value={simCourse}
              onChange={e => setSimCourse(e.target.value)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none"
            >
              {data.courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_id} · {c.title}</option>)}
            </select>
            <select
              value={simMode}
              onChange={e => setSimMode(e.target.value as 'attend' | 'miss')}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none"
            >
              <option value="attend">I attend</option>
              <option value="miss">I miss</option>
            </select>
            <input
              type="number"
              min={1}
              max={40}
              value={simCount}
              onChange={e => setSimCount(Math.max(1, Math.min(40, Number(e.target.value))))}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none"
            />
          </div>
          {simulated && (
            <div className="flex items-end gap-4 mt-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Projected</div>
                <div className={`text-2xl font-bold ${simulated.projected >= 75 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>{simulated.projected}%</div>
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)] pb-1">
                {simulated.attended} of {simulated.held} classes · need {data.target}%
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Recent activity</h3>
            <span className="text-[10px] text-[var(--color-text-muted)]">latest 20</span>
          </div>
          {data.log.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] py-4">No manual logs yet. Use + Present or − Absent above.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {data.log.map(entry => (
                <div key={entry.id} className="flex items-center gap-3 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${entry.present ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`} />
                  <span className="font-mono text-[var(--color-text-muted)]">{entry.course_id}</span>
                  <span className={entry.present ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>{entry.present ? 'Present' : 'Absent'}</span>
                  <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                    {new Date(entry.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <p className="text-[10px] text-[var(--color-text-muted)]">
        Demo record: seeded attendance is deterministic per student and subject. Timetable and exam data are live solver output.
      </p>
    </div>
  );
}
