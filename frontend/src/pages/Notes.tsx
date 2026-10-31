import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { AttendanceCourse, Note } from '../types';
import { useStudent } from '../StudentContext';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function NotesPage() {
  const { studentId } = useStudent();
  const [notes, setNotes] = useState<Note[]>([]);
  const [courses, setCourses] = useState<AttendanceCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [composer, setComposer] = useState<{ open: boolean; editing: Note | null; title: string; body: string; course: string; pinned: boolean }>({
    open: false, editing: null, title: '', body: '', course: '', pinned: false,
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.portalNotes(studentId), api.portalAttendance(studentId)])
      .then(([n, a]) => { setNotes(n); setCourses(a.courses); setError(''); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [studentId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return notes.filter(n => {
      if (courseFilter && n.course_id !== courseFilter) return false;
      if (!needle) return true;
      return n.title.toLowerCase().includes(needle) || n.body.toLowerCase().includes(needle);
    });
  }, [notes, query, courseFilter]);

  const openNew = () => setComposer({ open: true, editing: null, title: '', body: '', course: '', pinned: false });
  const openEdit = (n: Note) => setComposer({ open: true, editing: n, title: n.title, body: n.body, course: n.course_id ?? '', pinned: n.pinned });
  const close = () => setComposer(c => ({ ...c, open: false }));

  const save = async () => {
    if (!composer.body.trim() && !composer.title.trim()) return;
    setSaving(true);
    try {
      if (composer.editing) {
        const updated = await api.portalUpdateNote(composer.editing.id, {
          student_id: studentId,
          title: composer.title,
          body: composer.body,
          course_id: composer.course || null,
          pinned: composer.pinned,
        });
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
      } else {
        const created = await api.portalCreateNote({
          student_id: studentId,
          title: composer.title,
          body: composer.body,
          course_id: composer.course || null,
          pinned: composer.pinned,
        });
        setNotes(prev => [created, ...prev]);
      }
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (n: Note) => {
    try {
      const updated = await api.portalUpdateNote(n.id, { student_id: studentId, pinned: !n.pinned });
      setNotes(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (n: Note) => {
    if (!window.confirm(`Delete “${n.title}”?`)) return;
    try {
      await api.portalDeleteNote(n.id, studentId);
      setNotes(prev => prev.filter(x => x.id !== n.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={30} /></div>;

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Notes"
        sub={`${notes.length} note${notes.length === 1 ? '' : 's'} · saved for this profile`}
        actions={<Button onClick={openNew}>+ New note</Button>}
      />

      {error && <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-dim)] px-4 py-2 text-xs text-[var(--color-danger)]">{error}</div>}

      {composer.open && (
        <Card className="border-[var(--color-accent)]/40!">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{composer.editing ? 'Edit note' : 'New note'}</h3>
            <button onClick={close} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm">✕</button>
          </div>
          <input
            value={composer.title}
            onChange={e => setComposer(c => ({ ...c, title: e.target.value }))}
            placeholder="Title (optional)"
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <textarea
            value={composer.body}
            onChange={e => setComposer(c => ({ ...c, body: e.target.value }))}
            placeholder="Write your note, formula, or revision checklist…"
            rows={5}
            className="w-full mt-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-y"
          />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <select
              value={composer.course}
              onChange={e => setComposer(c => ({ ...c, course: e.target.value }))}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none"
            >
              <option value="">No course</option>
              {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_id} · {c.title}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={composer.pinned}
                onChange={e => setComposer(c => ({ ...c, pinned: e.target.checked }))}
                className="accent-[var(--color-accent)]"
              />
              Pin
            </label>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button onClick={save} loading={saving}>Save note</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search your notes…"
          className="flex-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
        <select
          value={courseFilter}
          onChange={e => setCourseFilter(e.target.value)}
          className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none"
        >
          <option value="">All courses</option>
          {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_id}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="✐"
          title={notes.length === 0 ? 'No notes yet' : 'No notes match your filter'}
          sub={notes.length === 0 ? 'Capture a formula, a doubt, or a revision checklist. Notes are saved per student profile.' : 'Try a different search or course filter.'}
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(n => {
            const course = courses.find(c => c.course_id === n.course_id);
            return (
              <Card key={n.id} className={n.pinned ? 'border-[var(--color-accent)]/40!' : ''}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {n.pinned && <span className="text-[var(--color-accent)] text-[10px]">● Pinned</span>}
                      {n.course_id && <Badge variant="info">{n.course_id}</Badge>}
                    </div>
                    <h3 className="text-sm font-semibold mt-1 break-words">{n.title}</h3>
                  </div>
                  <button
                    onClick={() => togglePin(n)}
                    title={n.pinned ? 'Unpin' : 'Pin'}
                    className={`text-sm ${n.pinned ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                  >★</button>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2 whitespace-pre-wrap line-clamp-6">{n.body || 'No content.'}</p>
                <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[var(--color-border-subtle)] text-[10px] text-[var(--color-text-muted)]">
                  <span>{timeAgo(n.updated_at)}</span>
                  {course && <span className="truncate">{course.title}</span>}
                  <span className="ml-auto flex gap-2">
                    <button onClick={() => openEdit(n)} className="hover:text-[var(--color-text-primary)]">Edit</button>
                    <button onClick={() => remove(n)} className="hover:text-[var(--color-danger)]">Delete</button>
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-[var(--color-text-muted)]">Notes persist in the portal store across page reloads and server restarts.</p>
    </div>
  );
}
