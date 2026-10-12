import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/pages/LoginPage';
import { authService } from '@/services/authService';
import { ApiError } from '@/services/apiClient';
import { makeUser, renderWithProviders } from '@/test/renderWithProviders';

vi.mock('@/services/authService', () => ({
  authService: { me: vi.fn(), csrf: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));

const svc = vi.mocked(authService);

function renderLogin(route = '/login') {
  return renderWithProviders(<LoginPage />, {
    route,
    path: '/login',
    extraRoutes: (
      <>
        <Route path="/dashboard" element={<p>Dashboard route</p>} />
        <Route path="/transformers" element={<p>Transformers route</p>} />
      </>
    ),
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.csrf.mockResolvedValue(undefined);
    svc.me.mockResolvedValue(null);
  });

  it('validates required fields before calling the API', async () => {
    renderLogin();
    await userEvent.click(await screen.findByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(svc.login).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    renderLogin();
    await userEvent.type(await screen.findByLabelText(/email/i), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/password/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(svc.login).not.toHaveBeenCalled();
  });

  it('shows the server error for bad credentials', async () => {
    svc.login.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Bad credentials'));
    renderLogin();
    await userEvent.type(await screen.findByLabelText(/email/i), 'ops@test.local');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  it('shows the throttling message on 429', async () => {
    svc.login.mockRejectedValue(new ApiError(429, 'TOO_MANY_REQUESTS', 'Too many login attempts. Try again in 60 seconds.'));
    renderLogin();
    await userEvent.type(await screen.findByLabelText(/email/i), 'ops@test.local');
    await userEvent.type(screen.getByLabelText(/password/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many login attempts. Try again in 60 seconds.');
  });

  it('logs in and redirects to the next param', async () => {
    svc.login.mockResolvedValue(makeUser('ENGINEER'));
    renderLogin(`/login?next=${encodeURIComponent('/transformers')}`);
    await userEvent.type(await screen.findByLabelText(/email/i), ' eng@test.local ');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Transformers route')).toBeInTheDocument();
    expect(svc.login).toHaveBeenCalledWith({ email: 'eng@test.local', password: 'secret' });
  });

  it('ignores external next targets and defaults to /dashboard', async () => {
    svc.login.mockResolvedValue(makeUser('ENGINEER'));
    renderLogin(`/login?next=${encodeURIComponent('//evil.example.com')}`);
    await userEvent.type(await screen.findByLabelText(/email/i), 'eng@test.local');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Dashboard route')).toBeInTheDocument();
  });

  it('redirects already-authenticated users', async () => {
    svc.me.mockResolvedValue(makeUser('ADMIN'));
    renderLogin();
    await waitFor(() => expect(screen.getByText('Dashboard route')).toBeInTheDocument());
  });
});
