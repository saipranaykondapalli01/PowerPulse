import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { RenderCapabilities } from '../webgl';
import { summary, transformers } from './fixtures';

const caps: RenderCapabilities = { webgl: false, lowEnd: false, reducedMotion: false, quality: 'high' };
const refetch = vi.fn();
let transformersResult: Record<string, unknown>;

vi.mock('@/hooks/useMonitoring', () => ({
  useAllTransformers: () => transformersResult,
  useDashboardSummary: () => ({ data: summary }),
  useLocations: () => ({ data: ['North Yard', 'South Yard'] }),
}));

vi.mock('@/three/webgl', () => ({
  useRenderCapabilities: () => caps,
}));

// The real scene needs WebGL; unit tests only check that the page chooses it.
vi.mock('@/three/GridScene', () => ({
  default: (props: { nodes: unknown[] }) => <div data-testid="grid-scene">{props.nodes.length} nodes in 3D</div>,
}));

import GridPage from '@/pages/GridPage';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

function renderPage(path = '/grid') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/grid" element={<GridPage />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  caps.webgl = false;
  caps.lowEnd = false;
  refetch.mockReset();
  transformersResult = {
    data: transformers,
    isPending: false,
    isSuccess: true,
    isError: false,
    isFetching: false,
    error: null,
    refetch,
  };
});

describe('GridPage', () => {
  it('falls back to the 2D map when WebGL is unavailable', () => {
    renderPage();
    expect(screen.getByRole('group', { name: /2D transformer network map/i })).toBeInTheDocument();
    expect(screen.queryByTestId('grid-scene')).not.toBeInTheDocument();
    expect(screen.getByText(/WebGL is unavailable/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3D view/ })).toBeDisabled();
  });

  it('renders the 3D scene when WebGL is available', async () => {
    caps.webgl = true;
    renderPage();
    expect(await screen.findByTestId('grid-scene')).toHaveTextContent('3 nodes in 3D');
  });

  it('uses the 2D map by default on low-end devices', () => {
    caps.webgl = true;
    caps.lowEnd = true;
    renderPage();
    expect(screen.getByRole('group', { name: /2D transformer network map/i })).toBeInTheDocument();
  });

  it('shows HUD counts from the dashboard summary', () => {
    renderPage();
    const hud = screen.getByRole('region', { name: 'Network summary' });
    expect(within(hud).getByText('42')).toBeInTheDocument();
    expect(within(hud).getByText('81')).toBeInTheDocument();
  });

  it('opens the detail panel when a 2D node is clicked, and navigates to details', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^TX-002, Critical/ }));
    const panel = screen.getByRole('region', { name: 'TX-002' });
    expect(within(panel).getByText('61.5 °C')).toBeInTheDocument();
    expect(within(panel).getByText('64 %')).toBeInTheDocument();
    expect(within(panel).getByText(/highest critical/)).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/grid?focus=tx-002');
    fireEvent.click(within(panel).getByRole('button', { name: /View alerts/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/alerts?transformerId=tx-002');
  });

  it('preselects ?focus=<id> and closes on Escape', () => {
    renderPage('/grid?focus=tx-001');
    expect(screen.getByRole('region', { name: 'TX-001' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'TX-001' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/grid$/);
  });

  it('selects from the keyboard-accessible list', () => {
    renderPage();
    const list = screen.getByRole('navigation', { name: /Transformers on the grid/ });
    fireEvent.click(within(list).getByRole('button', { name: /TX-003/ }));
    expect(screen.getByRole('region', { name: 'TX-003' })).toBeInTheDocument();
  });

  it('renders the transformer list inside its own scroll container', () => {
    renderPage();
    const nav = screen.getByRole('navigation', { name: /Transformers on the grid/ });
    const list = within(nav).getByRole('list');
    // The list scrolls within the column; the column itself clips so the page never grows past the viewport.
    expect(list).toHaveClass('overflow-y-auto', 'min-h-0', 'flex-1');
    expect(nav).toHaveClass('min-h-0', 'overflow-hidden');
    expect(within(list).getAllByRole('button')).toHaveLength(3);
    const aside = screen.getByRole('complementary', { name: /Selection and transformer list/ });
    expect(aside).toContainElement(nav);
    expect(aside).toHaveClass('min-h-0', 'lg:overflow-hidden');
  });

  it('filters by status', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^Critical/ }));
    const map = screen.getByRole('group', { name: /2D transformer network map/i });
    expect(within(map).getByText('TX-002')).toBeInTheDocument();
    expect(within(map).queryByText('TX-001')).not.toBeInTheDocument();
  });

  it('shows an error with retry', () => {
    transformersResult = { ...transformersResult, data: undefined, isSuccess: false, isError: true, error: new Error('boom') };
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the transformer network');
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows an empty state with no transformers', () => {
    transformersResult = { ...transformersResult, data: [] };
    renderPage();
    expect(screen.getByText(/No transformers are registered yet/)).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    transformersResult = { ...transformersResult, data: undefined, isPending: true, isSuccess: false };
    renderPage();
    expect(screen.getByText(/Loading network/)).toBeInTheDocument();
  });
});
