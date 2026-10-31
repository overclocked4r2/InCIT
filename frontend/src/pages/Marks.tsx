import { Fragment, useEffect, useState } from 'react';
import { api } from '../api';
import type { MarksResponse } from '../types';
import { useStudent } from '../StudentContext';
import { Badge, Card, EmptyState, PageHeader, ProgressBar, Spinner } from '../components/ui';

const GRADE_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  O: 'success', 'A+': 'success', A: 'info', 'B+': 'info', B: 'warning', C: 'warning', F: 'danger',
};

export function MarksPage() {
  const { studentId } = useStudent();
  const [data, setData] = useState<MarksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.portalMarks(studentId)
      .then(d => { if (alive) { setData(d); setError(''); } })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [studentId]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={30} /></div>;
  if (error || !data) return <Card className="border-[var(--color-danger)]!"><p className="text-sm text-[var(--color-danger)]">{error || 'No marks available.'}</p></Card>;

  const maxSgpa = Math.max(...data.history.map(h => h.sgpa), 10);
  const best = data.courses.find(c => c.course_id === data.best_course);
  const weakest = data.courses.find(c => c.course_id === data.weakest_course);

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Marks & CGPA"
        sub={`Semester ${data.semester} · ${data.published_marks} internal marks published`}
        actions={<Badge variant="info">Projected SGPA</Badge>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass p-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">SGPA</div>
          <div className="text-3xl font-bold text-[var(--color-accent)] mt-1">{data.sgpa.toFixed(2)}</div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{data.credits} credits this semester</div>
        </div>
        <div className="glass p-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">CGPA</div>
          <div className="text-3xl font-bold mt-1">{data.cgpa.toFixed(2)}</div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">All semesters</div>
        </div>
        <div className="glass p-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Marks scored</div>
          <div className="text-3xl font-bold mt-1">{data.scored_marks}<span className="text-sm font-normal text-[var(--color-text-muted)]"> / {data.published_marks}</span></div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">Internal assessments</div>
        </div>
        <div className="glass p-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Strongest subject</div>
          <div className="text-lg font-bold mt-1 truncate">{best?.course_id ?? '—'}</div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1 truncate">{best?.title ?? ''}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Semester performance</h3>
            <span className="text-[10px] text-[var(--color-text-muted)]">SGPA trend · past semesters are demo records</span>
          </div>
          <div className="flex items-end gap-4 h-40">
            {data.history.map(h => (
              <div key={h.semester} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-[10px] text-[var(--color-text-muted)]">{h.sgpa.toFixed(2)}</div>
                <div className="w-full flex items-end justify-center" style={{ height: 96 }}>
                  <div
                    className={`w-8 rounded-t-md transition-all duration-700 ${h.current ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-4)]'}`}
                    style={{ height: `${(h.sgpa / maxSgpa) * 100}%` }}
                    title={`${h.credits} credits`}
                  />
                </div>
                <div className={`text-[10px] ${h.current ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>Sem {h.semester}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-3">
            CGPA is credit-weighted across semesters. Current semester is highlighted.
          </p>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold mb-3">Grade scale</h3>
          <div className="space-y-1.5 text-xs">
            {[
              ['O', '90–100', '10'], ['A+', '80–89', '9'], ['A', '70–79', '8'],
              ['B+', '60–69', '7'], ['B', '50–59', '6'], ['C', '40–49', '5'],
            ].map(([g, range, pts]) => (
              <div key={g} className="flex items-center gap-2">
                <span className="w-7 font-semibold text-[var(--color-text-primary)]">{g}</span>
                <span className="text-[var(--color-text-muted)]">{range}%</span>
                <span className="ml-auto font-mono text-[var(--color-text-secondary)]">{pts} pts</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-[10px] text-[var(--color-text-muted)]">
            SGPA = Σ(credits × grade points) ÷ Σ credits. End-term marks are not published yet.
          </div>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Subject breakdown</h3>
          <span className="text-[10px] text-[var(--color-text-muted)]">Click a subject to see components</span>
        </div>
        {data.courses.length === 0 ? (
          <EmptyState icon="✦" title="No subjects registered" />
        ) : (
          <div className="space-y-1.5">
            {data.courses.map(c => (
              <Fragment key={c.course_id}>
                <button
                  onClick={() => setOpen(open === c.course_id ? null : c.course_id)}
                  className="w-full text-left rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3 hover:border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="w-full sm:w-72 shrink-0 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-[var(--color-text-muted)]">{c.course_id}</span>
                        {c.course_id === data.weakest_course && <span className="text-[9px] text-[var(--color-warning)]">focus</span>}
                      </div>
                      <div className="text-sm font-medium truncate">{c.title}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-[var(--color-text-muted)]">{c.scored} / {c.max}</span>
                        <span>{c.percent}%</span>
                      </div>
                      <ProgressBar value={c.percent} tone={c.percent < 50 ? 'danger' : c.percent < 70 ? 'warning' : 'success'} />
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-[var(--color-text-muted)]">{c.credits} cr</span>
                      <Badge variant={GRADE_TONE[c.grade] ?? 'default'}>{c.grade} · {c.grade_points}</Badge>
                      <span className="text-[var(--color-text-muted)] text-xs">{open === c.course_id ? '▾' : '▸'}</span>
                    </div>
                  </div>
                </button>
                {open === c.course_id && (
                  <div className="ml-0 sm:ml-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/40 px-4 py-3">
                    <div className="grid sm:grid-cols-4 gap-2">
                      {c.components.map(comp => (
                        <div key={comp.name} className="rounded-md bg-[var(--color-surface-2)] px-3 py-2">
                          <div className="text-[10px] text-[var(--color-text-muted)]">{comp.name}</div>
                          <div className="text-sm font-semibold mt-0.5">{comp.score} <span className="text-[10px] font-normal text-[var(--color-text-muted)]">/ {comp.max}</span></div>
                          <ProgressBar value={comp.percent} tone={comp.percent < 50 ? 'danger' : comp.percent < 70 ? 'warning' : 'success'} />
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-3">
                      {c.weekly_periods} contact periods/week · {c.session_ids.length} scheduled sessions
                    </div>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-[var(--color-text-muted)]">
        Internal assessment marks are demo records generated deterministically per student and subject. {weakest ? `Weakest subject: ${weakest.course_id}.` : ''}
      </p>
    </div>
  );
}
