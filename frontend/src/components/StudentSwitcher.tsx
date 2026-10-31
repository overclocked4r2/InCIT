import { useStudent } from '../StudentContext';

export function StudentSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { students, studentId, setStudentId } = useStudent();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-2xl animate-fade-up">
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-semibold">Student access</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Demo profiles mapped to real timetable groups. No password is stored.
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm">✕</button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-3 pb-3 space-y-1.5">
          {students.map(s => {
            const selected = s.id === studentId;
            return (
              <button
                key={s.id}
                onClick={() => { setStudentId(s.id); onClose(); }}
                className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent-dim)]'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  selected ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]'
                }`}>
                  {s.initials}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{s.name}</span>
                  <span className="block text-[11px] text-[var(--color-text-muted)] truncate">
                    {s.roll} · {s.group_name} · {s.semester_label}
                  </span>
                </span>
                {selected && <span className="text-[var(--color-accent)] text-xs">●</span>}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)]">
          Attendance and marks are deterministic demo records; timetables, exams and events come from the InCIT solver.
        </div>
      </div>
    </div>
  );
}
