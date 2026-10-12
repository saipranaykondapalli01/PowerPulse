import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransformersPage from '@/pages/TransformersPage';
import { authService } from '@/services/authService';
import { transformerService } from '@/services/transformerService';
import { makeUser, renderWithProviders } from '@/test/renderWithProviders';
import { makeTransformer, page } from '@/test/fixtures';

vi.mock('@/services/authService', () => ({
  authService: { me: vi.fn(), csrf: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));
vi.mock('@/services/transformerService', () => ({
  transformerService: { list: vi.fn(), locations: vi.fn(), all: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

const list = vi.mocked(transformerService.list);

describe('TransformersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.csrf).mockResolvedValue(undefined);
    vi.mocked(authService.me).mockResolvedValue(makeUser('OPERATOR'));
    vi.mocked(transformerService.locations).mockResolvedValue(['Riverside', 'Harbour']);
    list.mockResolvedValue(page([makeTransformer()]));
  });

  it('loads with default paging and sort', async () => {
    renderWithProviders(<TransformersPage />, { route: '/transformers', path: '/transformers' });
    expect(await screen.findByText('PP-TX-001')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ page: 0, size: 20, sort: 'healthScore,asc' });
  });

  it('debounces search into the q param and syncs it to the URL', async () => {
    renderWithProviders(<TransformersPage />, { route: '/transformers', path: '/transformers' });
    await screen.findByText('PP-TX-001');
    await userEvent.type(screen.getByLabelText('Search'), 'river');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'river', page: 0 })));
    expect(screen.getByTestId('location')).toHaveTextContent('q=river');
    // Intermediate keystrokes were debounced away.
    expect(list).not.toHaveBeenCalledWith(expect.objectContaining({ q: 'r' }));
  });

  it('applies location, status, health and sort filters', async () => {
    renderWithProviders(<TransformersPage />, { route: '/transformers', path: '/transformers' });
    await screen.findByText('PP-TX-001');
    await userEvent.selectOptions(screen.getByLabelText('Location'), 'Harbour');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'CRITICAL');
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'Highest temperature');
    await userEvent.type(screen.getByLabelText('Max health'), '60');
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          location: 'Harbour',
          status: 'CRITICAL',
          maxHealth: 60,
          sort: 'latestReading.temperatureC,desc',
          page: 0,
        }),
      ),
    );
  });

  it('reads initial filters from the URL', async () => {
    renderWithProviders(<TransformersPage />, {
      route: '/transformers?status=OFFLINE&minCapacity=250&page=2',
      path: '/transformers',
    });
    await screen.findByText('PP-TX-001');
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'OFFLINE', minCapacity: 250, page: 2 }));
  });

  it('hides "Register transformer" from operators and shows it to engineers', async () => {
    renderWithProviders(<TransformersPage />, { route: '/transformers', path: '/transformers' });
    await screen.findByText('PP-TX-001');
    expect(screen.queryByRole('button', { name: /register transformer/i })).not.toBeInTheDocument();
  });

  it('opens the register dialog for engineers', async () => {
    vi.mocked(authService.me).mockResolvedValue(makeUser('ENGINEER'));
    renderWithProviders(<TransformersPage />, { route: '/transformers', path: '/transformers' });
    await userEvent.click(await screen.findByRole('button', { name: /register transformer/i }));
    expect(screen.getByRole('dialog', { name: /register transformer/i })).toBeInTheDocument();
  });

  it('resets every filter (but keeps sort) from the filter bar', async () => {
    renderWithProviders(<TransformersPage />, {
      route: '/transformers?status=OFFLINE&location=Harbour&maxHealth=50&sort=code,asc',
      path: '/transformers',
    });
    await screen.findByText('PP-TX-001');
    expect(screen.getByText('filters active')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reset filters/i }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/transformers?sort=code%2Casc'));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ page: 0, size: 20, sort: 'code,asc' }));
  });

  it('shows the asset count and stacked rows with stale readings marked on narrow screens', async () => {
    list.mockResolvedValue(page([makeTransformer({ stale: true })], { totalElements: 42 }));
    renderWithProviders(<TransformersPage />, { route: '/transformers', path: '/transformers' });
    const row = await screen.findByRole('link', { name: 'Open PP-TX-001 Riverside 1' });
    expect(row).toHaveAttribute('href', '/transformers/t1');
    expect(row).toHaveTextContent(/stale/i);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('registered assets')).toBeInTheDocument();
  });
});
