import { useState } from 'react';
import { api, type DemoUser } from '../api';
import { BrandMark } from '../components/ui';

type LoginPageProps = {
  onLogin: (token: string, user: DemoUser) => void;
};

const WEEK_CELLS = [
  'plan', '', 'book', '', 'resolve', '',
  '', 'book', '', 'plan', '', '',
  'resolve', '', 'plan', '', 'book', '',
  '', 'resolve', '', 'book', '', 'plan',
];

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const moveBackdrop = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--pointer-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    event.currentTarget.style.setProperty('--pointer-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.login(username, password);
      onLogin(result.token, result.user);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell" onPointerMove={moveBackdrop}>
      <div className="login-layout">
        <section className="login-story" aria-label="About InCIT">
          <div className="login-brand" aria-label="InCIT">
            <BrandMark className="login-brand-mark" />
            <span className="login-brand-name">InCIT<span> / CAMPUS OPERATIONS</span></span>
          </div>

          <div className="login-intro">
            <div className="login-eyebrow"><span className="login-live-dot" /> INSTITUTIONAL SCHEDULING</div>
            <h1>Make room for<br /><span>great work.</span></h1>
            <p>One considered workspace for timetables, campus bookings, and the changes that keep a busy week moving.</p>
          </div>

          <div className="login-preview" aria-label="Illustration of a weekly campus schedule">
            <div className="login-preview-head">
              <div>
                <span className="login-preview-kicker">YOUR CAMPUS, IN SYNC</span>
                <strong>A week with room to move</strong>
              </div>
              <span className="login-preview-icon" aria-hidden="true">↗</span>
            </div>
            <div className="login-calendar" aria-hidden="true">
              <div className="login-calendar-days"><span />{['MON', 'TUE', 'WED', 'THU', 'FRI'].map(day => <span key={day}>{day}</span>)}</div>
              {['09', '11', '13', '15'].map((time, row) => (
                <div className="login-calendar-row" key={time}>
                  <span className="login-calendar-time">{time}</span>
                  {WEEK_CELLS.slice(row * 5, row * 5 + 5).map((cell, column) => (
                    <span key={`${time}-${column}`} className={cell ? `login-calendar-block login-calendar-${cell}` : 'login-calendar-empty'}>
                      {cell && row % 2 === 0 && column % 2 === 0 ? <i /> : null}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="login-preview-legend">
              <span><i className="login-legend-plan" />Plan</span>
              <span><i className="login-legend-book" />Book</span>
              <span><i className="login-legend-resolve" />Resolve</span>
            </div>
          </div>

          <div className="login-story-footer">
            <span>THOUGHTFUL SCHEDULING</span>
            <span>BUILT FOR CAMPUS TEAMS</span>
          </div>
        </section>

        <section className="login-access" aria-labelledby="login-heading">
          <div className="login-form-card">
            <div className="login-form-topline">
              <span className="login-form-symbol" aria-hidden="true">✳</span>
              <span>STAFF WORKSPACE</span>
            </div>
            <h2 id="login-heading">Welcome back</h2>
            <p className="login-form-copy">Sign in to continue to your campus workspace.</p>

            <form onSubmit={submit} className="login-form">
              {error && <p role="alert" className="login-error">{error}</p>}
              <label className="login-label" htmlFor="login-username">Username</label>
              <div className="login-input-wrap">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="login-input-icon"><path d="M3.2 16.2c.6-2.5 2.8-3.8 6.8-3.8s6.2 1.3 6.8 3.8M10 10a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 10 10Z" /></svg>
                <input id="login-username" type="text" autoComplete="username" placeholder="name@institution.edu" required value={username} onChange={event => setUsername(event.target.value)} className="login-input" />
              </div>

              <label className="login-label" htmlFor="login-password">Password</label>
              <div className="login-input-wrap">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="login-input-icon"><rect x="3.5" y="8.5" width="13" height="9" rx="2" /><path d="M6.5 8.5V6a3.5 3.5 0 1 1 7 0v2.5M10 12v2" /></svg>
                <input id="login-password" type="password" autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={event => setPassword(event.target.value)} className="login-input" />
              </div>

              <button disabled={loading} className="login-submit">
                <span>{loading ? 'Signing in…' : 'Sign in'}</span>
                {!loading && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <div className="login-divider"><span />DEMO ACCESS<span /></div>
            <p className="login-demo-note">This workspace uses demo staff accounts. Your role determines which actions are available.</p>
          </div>
          <div className="login-access-footer"><span>INSTITUTIONAL SCHEDULER</span><span>ROLE-BASED ACCESS</span></div>
        </section>
      </div>
    </main>
  );
}
