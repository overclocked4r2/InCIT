import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { ExamAssignment } from '../types';
import { Badge, Card, EmptyState, PageHeader, Spinner } from '../components/ui';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function ExamsPage() {
  const [exams, setExams] = useState<ExamAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.exams().then(data => { setExams(data); setError(''); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const byDay = useMemo(() => DAYS.map(day => [day, exams.filter(exam => exam.day === day)] as const), [exams]);
  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={30} /></div>;
  if (error) return <Card className="border-[var(--color-danger)]!"><p className="text-sm text-[var(--color-danger)]">{error}</p></Card>;

  return <div className="space-y-5 animate-fade-up">
    <PageHeader title="Exam schedule" sub="Staff view of allocated exam sessions and rooms" />
    <div className="glass p-4 flex items-center gap-3"><Badge variant="info">{exams.length} exams</Badge><Badge variant="success">50% room capacity</Badge><p className="text-xs text-[var(--color-text-muted)]">Exam rooms and time slots are assigned by the scheduler.</p></div>
    {exams.length === 0 ? <EmptyState icon="◇" title="No exam schedule available" sub="Generate a timetable to create the exam schedule." /> : <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3">
      {byDay.map(([day, dayExams]) => <section key={day} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 min-h-[160px]">
        <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold">{day}</h2><span className="text-xs text-[var(--color-text-muted)]">{dayExams.length}</span></div>
        <div className="space-y-2">{dayExams.length === 0 ? <p className="text-xs text-[var(--color-text-muted)]">No exams</p> : dayExams.map(exam => <div key={exam.exam_id} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-2"><div className="flex justify-between gap-2"><span className="text-xs font-medium">{exam.exam_id}</span><Badge variant={exam.session === 'AM' ? 'warning' : 'info'}>{exam.session}</Badge></div><p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Rooms: {exam.rooms.join(', ')}</p></div>)}</div>
      </section>)}
    </div>}
  </div>;
}
