import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { ExamEntry, ExamsResponse } from '../types';
import { useStudent } from '../StudentContext';
import { Badge, Card, EmptyState, PageHeader, ProgressBar, Spinner } from '../components/ui';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function ExamCard({ exam, mine }: { exam: ExamEntry; mine: boolean }) {
  const utilization = exam.seats ? Math.round((exam.size / exam.seats) * 100) : 0;
  return (
    <div className={`rounded-lg border p-3 ${mine ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-dim)]/30' : 'border-[var(--color-border)] bg-[var(--color-surface-1)]'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{exam.course_ids.join(' · ')}</span>
            {mine && <Badge variant="info">Your exam</Badge>}
          </div>
          <div className="text-xs font-medium mt-1 leading-snug">{exam.titles.join(' + ')}</div>
        </div>
        <Badge variant={exam.session === 'AM' ? 'warning' : 'info'}>{exam.session}</Badge>
      </div>
      <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
        {exam.day} · {exam.start}–{exam.end} · {exam.duration_hours}h
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded bg-[var(--color-surface-2)] px-2 py-1">
          <span className="text-[var(--color-text-muted)]">Students</span>
          <div className="font-semibold text-[var(--color-text-secondary)]">{exam.size}</div>
        </div>
        <div className="rounded bg-[var(--color-surface-2)] px-2 py-1">
          <span className="text-[var(--color-text-muted)]">Half-cap seats</span>
          <div className="font-semibold text-[var(--color-text-secondary)]">{exam.seats}</div>
        </div>
      </div>
      <div className="mt-2">
        <ProgressBar value={utilization} tone={utilization > 95 ? 'warning' : 'success'} />
        <div className="text-[9px] text-[var(--color-text-muted)] mt-1">{utilization}% of half-capacity used</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {exam.rooms.map(r => (
          <span key={r.id} className="text-[9px] rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[var(--color-text-secondary)]">
            {r.name} · {r.capacity}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ExamsPage() {
  const { studentId, student } = useStudent();
  const [data, setData] = useState<ExamsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'mine' | 'all'>('mine');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.portalExams(studentId)
      .then(d => { if (alive) { setData(d); setError(''); } })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [studentId]);

  const rows = useMemo(() => {
    if (!data) return [];
    return mode === 'mine' ? data.exams : data.all_exams;
  }, [data, mode]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={30} /></div>;
  if (error || !data) return <Card className="border-[var(--color-danger)]!"><p className="text-sm text-[var(--color-danger)]">{error || 'No exam data.'}</p></Card>;

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Exam timetable"
        sub={student ? `${student.group_name} · exam week · ${data.my_count} papers for you` : ''}
        actions={
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            <button onClick={() => setMode('mine')} className={`px-3 py-1.5 text-xs ${mode === 'mine' ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>My exams {data.my_count}</button>
            <button onClick={() => setMode('all')} className={`px-3 py-1.5 text-xs ${mode === 'all' ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>All {data.total_count}</button>
          </div>
        }
      />

      <div className="glass p-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="success">No clashes</Badge>
            <Badge variant="info">50% room capacity</Badge>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">{data.policy}</p>
        </div>
        <div className="flex gap-3 text-xs">
          <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">AM session</div>
            <div className="font-semibold mt-0.5">09:30–11:30</div>
          </div>
          <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">PM session</div>
            <div className="font-semibold mt-0.5">14:00–16:00</div>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="◇" title="No exams scheduled for your group" sub="Switch to All exams to see the full exam week." />
      ) : (
        <>
          {/* Day columns */}
          <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-2">
            {DAYS.map(day => {
              const dayExams = rows.filter(e => e.day === day);
              return (
                <div key={day} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2 min-h-[140px]">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-[11px] font-semibold">{day}</span>
                    <span className="text-[9px] text-[var(--color-text-muted)]">{dayExams.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {dayExams.length === 0 && <div className="text-[10px] text-[var(--color-text-muted)] px-1 py-2">—</div>}
                    {dayExams.map(e => (
                      <div key={e.exam_id} className={`rounded-md border px-2 py-1.5 ${e.is_mine ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-dim)]/40' : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/50'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-semibold">{e.session}</span>
                          <span className="text-[9px] text-[var(--color-text-muted)]">{e.start}</span>
                        </div>
                        <div className="text-[10px] font-medium mt-1 truncate">{e.course_ids.join(', ')}</div>
                        <div className="text-[9px] text-[var(--color-text-muted)] truncate">{e.rooms.map(r => r.id).join(', ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2">
            <h3 className="text-sm font-semibold">Seat plans</h3>
            <span className="text-[10px] text-[var(--color-text-muted)]">Rooms are allocated at half capacity</span>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map(e => <ExamCard key={e.exam_id} exam={e} mine={e.is_mine} />)}
          </div>
        </>
      )}
    </div>
  );
}
