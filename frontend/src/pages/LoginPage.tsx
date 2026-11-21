import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface LoginLocationState {
  from?: { pathname?: string };
}

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/overview" replace />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      const state = location.state as LoginLocationState | null;
      navigate(state?.from?.pathname ?? '/overview', { replace: true });
    } catch (reason: unknown) {
      setError(reason instanceof ApiError && reason.status === 401
        ? 'Invalid username or password.'
        : reason instanceof Error ? reason.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <form
        onSubmit={event => void submit(event)}
        className="w-full max-w-md space-y-5 rounded-2xl bg-surface-container-lowest p-8 shadow-xl"
      >
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Sign in</h1>
          <p className="mt-2 text-on-surface-variant">Access the CloudOps Platform.</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-error-container p-3 text-on-error-container">{error}</p>}
        <label className="block space-y-1">
          <span>Username</span>
          <input
            autoComplete="username"
            required
            value={username}
            onChange={event => setUsername(event.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2"
          />
        </label>
        <label className="block space-y-1">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
