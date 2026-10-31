import { useState } from 'react';
import { api, type DemoUser } from '../api';

type LoginPageProps = {
  onLogin: (token: string, user: DemoUser) => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('admin@incit.demo');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <main className="min-h-screen grid place-items-center bg-[var(--color-bg)] p-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[var(--color-accent)]">INCIT DEMO</p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">Staff sign in</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Use one of the four demo staff accounts.</p>
        </div>
        {error && <p className="rounded-md bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]">{error}</p>}
        <label className="block text-sm text-[var(--color-text-secondary)]">
          Username
          <input value={username} onChange={event => setUsername(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--color-text-primary)]" />
        </label>
        <label className="block text-sm text-[var(--color-text-secondary)]">
          Password
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--color-text-primary)]" />
        </label>
        <button disabled={loading} className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 font-semibold text-[var(--color-on-accent)] disabled:opacity-60">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
