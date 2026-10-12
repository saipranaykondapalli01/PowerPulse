import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { authService } from '@/services/authService';
import { createTestQueryClient, LocationProbe, makeUser } from '@/test/renderWithProviders';

vi.mock('@/services/authService', () => ({
  authService: { me: vi.fn(), csrf: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));

const me = vi.mocked(authService.me);

function renderAt(route: string) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<p>Login screen</p>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<p>Dashboard content</p>} />
              <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route path="/admin/users" element={<p>Admin users content</p>} />
              </Route>
            </Route>
          </Routes>
          <LocationProbe />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.mocked(authService.csrf).mockResolvedValue(undefined);
    me.mockReset();
  });

  it('redirects anonymous users to /login with a next param', async () => {
    me.mockResolvedValue(null);
    renderAt('/dashboard?status=CRITICAL');
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      `/login?next=${encodeURIComponent('/dashboard?status=CRITICAL')}`,
    );
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('renders the route for an authenticated user', async () => {
    me.mockResolvedValue(makeUser('OPERATOR'));
    renderAt('/dashboard');
    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
  });

  it('shows a not-permitted state when the role is insufficient', async () => {
    me.mockResolvedValue(makeUser('OPERATOR'));
    renderAt('/admin/users');
    expect(await screen.findByText(/403 · Not permitted/i)).toBeInTheDocument();
    expect(screen.queryByText('Admin users content')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/dashboard');
  });

  it('allows the matching role', async () => {
    me.mockResolvedValue(makeUser('ADMIN'));
    renderAt('/admin/users');
    expect(await screen.findByText('Admin users content')).toBeInTheDocument();
  });
});
