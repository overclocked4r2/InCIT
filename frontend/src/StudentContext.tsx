import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import type { PortalStudent } from './types';

const STORAGE_KEY = 'incit.student';

interface StudentContextValue {
  students: PortalStudent[];
  student: PortalStudent | null;
  studentId: string;
  setStudentId: (id: string) => void;
  loading: boolean;
  error: string;
  refresh: () => void;
}

const StudentContext = createContext<StudentContextValue | null>(null);

export function StudentProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<PortalStudent[]>([]);
  const [studentId, setStudentIdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? 'STU-001',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.portalStudents()
      .then(list => {
        setStudents(list);
        setError('');
        if (list.length && !list.some(s => s.id === studentId)) {
          setStudentIdState(list[0].id);
          localStorage.setItem(STORAGE_KEY, list[0].id);
        }
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const setStudentId = useCallback((id: string) => {
    setStudentIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const student = useMemo(
    () => students.find(s => s.id === studentId) ?? students[0] ?? null,
    [students, studentId],
  );

  return (
    <StudentContext.Provider
      value={{ students, student, studentId, setStudentId, loading, error, refresh: load }}
    >
      {children}
    </StudentContext.Provider>
  );
}

export function useStudent() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error('useStudent must be used inside StudentProvider');
  return ctx;
}
