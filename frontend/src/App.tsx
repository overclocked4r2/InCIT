import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { TimetablePage } from './pages/Timetable';
import { NLBookingPage } from './pages/NLBooking';
import { SpectraWeekPage } from './pages/SpectraWeek';
import { DisruptionPage } from './pages/Disruption';
import { AuditPage } from './pages/Audit';
import { ExamsPage } from './pages/Exams';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
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
