import { useEffect, useState, type FormEvent } from 'react';
import { api, type ManualBookingRequest } from '../api';
import { Card, Badge } from '../components/ui';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

export function ManualFormsPage() {
  const [rooms, setRooms] = useState<Array<{ id: string; name: string }>>([]);
  const [sessions, setSessions] = useState<Array<{ id: string; course_id: string }>>([]);
  const [booking, setBooking] = useState<ManualBookingRequest>({
    room_id: '', day: 'MON', start_period: 1, duration_periods: 1, purpose: '', attendance: 1, needs: [],
  });
  const [schedule, setSchedule] = useState({ session_id: '', new_day: 'MON', new_start_period: 1, new_room_id: '', reason: '' });
  const [bookingMessage, setBookingMessage] = useState<{ status: string; text: string }>();
  const [scheduleMessage, setScheduleMessage] = useState<{ status: string; text: string }>();
  const [facultyText, setFacultyText] = useState('');
  const [facultyMessage, setFacultyMessage] = useState<{ status: string; text: string }>();
  const [whySession, setWhySession] = useState('');
  const [whyBooking, setWhyBooking] = useState('');
  const [whyMessage, setWhyMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.rooms(), api.sessions()])
      .then(([roomList, sessionList]) => {
        setRooms(roomList.map(room => ({ id: room.id, name: room.name })));
        setSessions(sessionList.map(session => ({ id: session.id, course_id: session.course_id })));
        if (roomList[0]) {
          setBooking(current => ({ ...current, room_id: roomList[0].id }));
          setSchedule(current => ({ ...current, new_room_id: roomList[0].id }));
        }
        if (sessionList[0]) setSchedule(current => ({ ...current, session_id: sessionList[0].id }));
      })
      .catch(() => setBookingMessage({ status: 'rejected', text: 'Could not load rooms and sessions. Start the backend, then refresh.' }));
  }, []);

  const submitBooking = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.manualBooking(booking);
      const place = result.booking ? ` ${result.booking.room_name}, ${result.booking.day} P${result.booking.start_period}–P${result.booking.end_period}.` : '';
      setBookingMessage({ status: result.status, text: `${result.message}${place}` });
    } catch (error) {
      setBookingMessage({ status: 'rejected', text: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const submitSchedule = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.reschedule(schedule);
      setScheduleMessage({ status: result.success ? 'pending' : 'rejected', text: result.message });
    } catch (error) {
      setScheduleMessage({ status: 'rejected', text: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const submitFacultyChange = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.facultyChange(facultyText);
      setFacultyMessage({ status: result.status, text: result.proposal?.message ?? result.message ?? 'Please add the missing details.' });
    } catch (error) {
      setFacultyMessage({ status: 'rejected', text: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const askWhy = async (kind: 'class' | 'booking') => {
    setLoading(true);
    try {
      const result = kind === 'class' ? await api.explainClass(whySession) : await api.explainBooking(whyBooking);
      setWhyMessage(result.message);
    } catch (error) {
      setWhyMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="text-lg font-bold tracking-tight">Manual booking</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">This form reserves the room after InCIT’s deterministic checks pass. It does not use an LLM.</p>
        <form className="grid sm:grid-cols-2 gap-3 mt-4" onSubmit={submitBooking}>
          <label className="text-sm">Room
            <select required value={booking.room_id} onChange={e => setBooking({ ...booking, room_id: e.target.value })} className="form-input mt-1 w-full">
              <option value="">Choose a room</option>
              {rooms.map(room => <option key={room.id} value={room.id}>{room.id} — {room.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Day
            <select value={booking.day} onChange={e => setBooking({ ...booking, day: e.target.value })} className="form-input mt-1 w-full">
              {DAYS.map(day => <option key={day}>{day}</option>)}
            </select>
          </label>
          <label className="text-sm">Start period
            <input required min="1" max="13" type="number" value={booking.start_period} onChange={e => setBooking({ ...booking, start_period: Number(e.target.value) })} className="form-input mt-1 w-full" />
          </label>
          <label className="text-sm">Duration (periods)
            <input required min="1" max="13" type="number" value={booking.duration_periods} onChange={e => setBooking({ ...booking, duration_periods: Number(e.target.value) })} className="form-input mt-1 w-full" />
          </label>
          <label className="text-sm">Attendance
            <input required min="1" type="number" value={booking.attendance} onChange={e => setBooking({ ...booking, attendance: Number(e.target.value) })} className="form-input mt-1 w-full" />
          </label>
          <label className="text-sm">Needs (comma separated)
            <input value={booking.needs.join(', ')} onChange={e => setBooking({ ...booking, needs: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })} className="form-input mt-1 w-full" placeholder="projector, accessible" />
          </label>
          <label className="text-sm sm:col-span-2">Purpose
            <input required value={booking.purpose} onChange={e => setBooking({ ...booking, purpose: e.target.value })} className="form-input mt-1 w-full" placeholder="Guest lecture" />
          </label>
          <div className="sm:col-span-2"><button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Validating…' : 'Validate and reserve'}</button></div>
        </form>
        {bookingMessage && <p className="mt-3 text-sm"><Badge variant={bookingMessage.status === 'approved' ? 'success' : bookingMessage.status === 'not_allowed' ? 'info' : 'danger'}>{bookingMessage.status.replace('_', ' ')}</Badge> <span className="ml-2">{bookingMessage.text}</span></p>}
      </Card>

      <Card>
        <h2 className="text-lg font-bold tracking-tight">Manual session change</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Authorised staff can submit a change. Conflicts are blocked; valid changes wait for Admin approval.</p>
        <form className="grid sm:grid-cols-2 gap-3 mt-4" onSubmit={submitSchedule}>
          <label className="text-sm">Session
            <select required value={schedule.session_id} onChange={e => setSchedule({ ...schedule, session_id: e.target.value })} className="form-input mt-1 w-full">
              <option value="">Choose a session</option>
              {sessions.map(session => <option key={session.id} value={session.id}>{session.id} — {session.course_id}</option>)}
            </select>
          </label>
          <label className="text-sm">New room
            <select required value={schedule.new_room_id} onChange={e => setSchedule({ ...schedule, new_room_id: e.target.value })} className="form-input mt-1 w-full">
              <option value="">Choose a room</option>
              {rooms.map(room => <option key={room.id} value={room.id}>{room.id} — {room.name}</option>)}
            </select>
          </label>
          <label className="text-sm">New day
            <select value={schedule.new_day} onChange={e => setSchedule({ ...schedule, new_day: e.target.value })} className="form-input mt-1 w-full">
              {DAYS.map(day => <option key={day}>{day}</option>)}
            </select>
          </label>
          <label className="text-sm">New start period
            <input required min="1" max="13" type="number" value={schedule.new_start_period} onChange={e => setSchedule({ ...schedule, new_start_period: Number(e.target.value) })} className="form-input mt-1 w-full" />
          </label>
          <label className="text-sm sm:col-span-2">Reason
            <input required value={schedule.reason} onChange={e => setSchedule({ ...schedule, reason: e.target.value })} className="form-input mt-1 w-full" placeholder="Room maintenance" />
          </label>
          <div className="sm:col-span-2"><button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">{loading ? 'Submitting…' : 'Submit session change'}</button></div>
        </form>
        {scheduleMessage && <p className="mt-3 text-sm"><Badge variant={scheduleMessage.status === 'pending' ? 'warning' : 'danger'}>{scheduleMessage.status}</Badge> <span className="ml-2">{scheduleMessage.text}</span></p>}
      </Card>

      <Card>
        <h2 className="text-lg font-bold tracking-tight">Faculty assistant</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Describe a class change in plain language. The assistant only makes a draft; the solver checks it and an Admin must approve it.</p>
        <form className="mt-4 space-y-3" onSubmit={submitFacultyChange}>
          <textarea required value={facultyText} onChange={e => setFacultyText(e.target.value)} className="form-input w-full min-h-24" placeholder="Move session CSE101-L1 to Tuesday period 3 because of a faculty meeting." />
          <button type="submit" disabled={!facultyText.trim() || loading} className="btn-primary disabled:opacity-60">{loading ? 'Checking…' : 'Create safe proposal'}</button>
        </form>
        {facultyMessage && <p className="mt-3 text-sm"><Badge variant={facultyMessage.status === 'pending' ? 'warning' : facultyMessage.status === 'needs_clarification' ? 'info' : 'danger'}>{facultyMessage.status.replace('_', ' ')}</Badge> <span className="ml-2">{facultyMessage.text}</span></p>}
      </Card>

      <Card>
        <h2 className="text-lg font-bold tracking-tight">Why?</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">These answers use recorded reason codes. If AI phrasing is unavailable, you will see those codes directly.</p>
        <div className="grid min-w-0 sm:grid-cols-2 gap-3 mt-4">
          <div className="flex min-w-0 gap-2"><input value={whySession} onChange={e => setWhySession(e.target.value)} className="form-input min-w-0 flex-1" placeholder="Class session ID" /><button type="button" disabled={!whySession || loading} onClick={() => askWhy('class')} className="btn-secondary disabled:opacity-60 shrink-0">Why class?</button></div>
          <div className="flex min-w-0 gap-2"><input value={whyBooking} onChange={e => setWhyBooking(e.target.value)} className="form-input min-w-0 flex-1" placeholder="Booking request ID" /><button type="button" disabled={!whyBooking || loading} onClick={() => askWhy('booking')} className="btn-secondary disabled:opacity-60 shrink-0">Why booking?</button></div>
        </div>
        {whyMessage && <pre className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{whyMessage}</pre>}
      </Card>
    </div>
  );
}
