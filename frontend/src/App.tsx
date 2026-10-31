import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { TimetablePage } from './pages/Timetable';
import { NLBookingPage } from './pages/NLBooking';
import { SpectraWeekPage } from './pages/SpectraWeek';
import { DisruptionPage } from './pages/Disruption';
import { AuditPage } from './pages/Audit';
import { ExamsPage } from './pages/Exams';
import { LoginPage } from './pages/Login';
import { api, setAuthToken, type DemoUser } from './api';

export function App() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('incit_demo_token');
    if (!token) {
      setCheckingSession(false);
      return;
    }
    setAuthToken(token);
    api.me().then(setUser).catch(() => {
      setAuthToken(null);
      localStorage.removeItem('incit_demo_token');
    }).finally(() => setCheckingSession(false));
  }, []);

  const handleLogin = (token: string, signedInUser: DemoUser) => {
    setAuthToken(token);
    localStorage.setItem('incit_demo_token', token);
    setUser(signedInUser);
  };

  const logout = () => {
    setAuthToken(null);
    localStorage.removeItem('incit_demo_token');
    setUser(null);
  };

  if (checkingSession) return <main className="min-h-screen grid place-items-center text-[var(--color-text-muted)]">Checking sign in…</main>;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <Routes>
      <Route element={<><div className="fixed right-4 top-3 z-50 flex items-center gap-2 text-xs text-[var(--color-text-muted)]"><span>{user.name} · {user.role.replace('_', ' ')}</span><button onClick={logout} className="rounded border border-[var(--color-border)] px-2 py-1">Sign out</button></div><Layout /></>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="booking" element={<NLBookingPage />} />
        <Route path="spectra" element={<SpectraWeekPage />} />
        <Route path="disruption" element={<DisruptionPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
    </Routes>
  );
}
