import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { TimetablePage } from './pages/Timetable';
import { NLBookingPage } from './pages/NLBooking';
import { SpectraWeekPage } from './pages/SpectraWeek';
import { DisruptionPage } from './pages/Disruption';
import { AuditPage } from './pages/Audit';
import { StudentHomePage } from './pages/StudentHome';
import { MyTimetablePage } from './pages/MyTimetable';
import { AttendancePage } from './pages/Attendance';
import { MarksPage } from './pages/Marks';
import { ExamsPage } from './pages/Exams';
import { PlannerPage } from './pages/Planner';
import { NotesPage } from './pages/Notes';
import { CampusLifePage } from './pages/CampusLife';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<StudentHomePage />} />
        <Route path="my-timetable" element={<MyTimetablePage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="marks" element={<MarksPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="planner" element={<PlannerPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="campus-life" element={<CampusLifePage />} />
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
