import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api/client';
import { AuthProvider, AdminOnly, RequireAuth } from './AuthContext';
import { LoginPage } from '../pages/LoginPage';

function makeToken(role: 'admin' | 'viewer'): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-1', role }));
  return `${header}.${payload}.signature`;
}

function AuthRoutes() {
  return (
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/overview" element={<p>Protected dashboard</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('authentication UI', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('logs in, stores the token for the tab, and navigates to the protected route', async () => {
    const token = makeToken('admin');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: token,
      token_type: 'bearer',
      expires_in: 1800,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthRoutes />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Protected dashboard')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('cloudops_access_token')).toBe(token);
  });

  it('clears the session and redirects to login after a 401', async () => {
    window.sessionStorage.setItem('cloudops_access_token', makeToken('viewer'));
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'Invalid authentication credentials' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    function ExpiringRequest() {
      return (
        <button type="button" onClick={() => void request('/applications').catch(() => undefined)}>
          Load protected data
        </button>
      );
    }

    render(
      <MemoryRouter initialEntries={['/private']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/private" element={<ExpiringRequest />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load protected data' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(window.sessionStorage.getItem('cloudops_access_token')).toBeNull();
    await waitFor(() => {
      const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
      expect(new Headers(requestInit.headers).get('Authorization')).toBe(`Bearer ${makeToken('viewer')}`);
    });
  });

  it('hides admin write controls from viewers and shows them to admins', () => {
    const renderRoleControls = (role: 'admin' | 'viewer') => {
      window.sessionStorage.setItem('cloudops_access_token', makeToken(role));
      return render(
        <MemoryRouter>
          <AuthProvider>
            <AdminOnly><button type="button">Create application</button></AdminOnly>
          </AuthProvider>
        </MemoryRouter>,
      );
    };

    const viewer = renderRoleControls('viewer');
    expect(screen.queryByRole('button', { name: 'Create application' })).not.toBeInTheDocument();
    viewer.unmount();

    renderRoleControls('admin');
    expect(screen.getByRole('button', { name: 'Create application' })).toBeInTheDocument();
  });
});
