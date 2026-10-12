import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NetworkPreviewNode } from '@/types/api';

const motionState = vi.hoisted(() => ({ reduce: false }));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

vi.mock('@/hooks/useMonitoring', () => ({ usePublicNetworkPreview: vi.fn() }));

vi.mock('@/three/NetworkPreview', () => ({
  default: ({ nodes }: { nodes: NetworkPreviewNode[] }) => <div data-testid="network-preview">{nodes.length}</div>,
}));

import { usePublicNetworkPreview } from '@/hooks/useMonitoring';
import LandingPage from '../LandingPage';

const node = (over: Partial<NetworkPreviewNode>): NetworkPreviewNode => ({
  id: 'id',
  code: 'TX-000',
  name: 'Transformer',
  location: 'North',
  gridX: 0,
  gridZ: 0,
  connectedTo: [],
  status: 'HEALTHY',
  healthScore: 90,
  loadPct: 50,
  temperatureC: 60,
  oilLevelPct: 80,
  voltageV: 230,
  currentA: 100,
  ratedCapacityKva: 500,
  activeFaultCount: 0,
  simulated: true,
  ...over,
});

const NODES: NetworkPreviewNode[] = [
  node({ id: 'a', code: 'TX-101', connectedTo: ['b'] }),
  node({
    id: 'b',
    code: 'TX-102',
    gridX: 4,
    gridZ: 3,
    status: 'WARNING',
    healthScore: 70,
    loadPct: 70,
    temperatureC: 70,
    oilLevelPct: 90,
    voltageV: 240,
    currentA: 120,
  }),
];

type HookResult = Partial<ReturnType<typeof usePublicNetworkPreview>>;
const mockHook = (r: HookResult) => vi.mocked(usePublicNetworkPreview).mockReturnValue(r as ReturnType<typeof usePublicNetworkPreview>);

function setDesktop(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width: 768px') ? matches : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

const renderPage = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LandingPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  motionState.reduce = false;
  setDesktop(false);
  mockHook({ data: NODES, isLoading: false, isError: false, isSuccess: true });
});

afterEach(() => vi.clearAllMocks());

describe('LandingPage', () => {
  it('renders every section with its headline and landmarks', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'SEE THE FAULT. BEFORE THE FAILURE.' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const name of [
      'EVERY TRANSFORMER TELLS A STORY.',
      'THE GRID, IN A DIFFERENT LIGHT.',
      'KNOW WHAT IS HAPPENING.',
      'WHEN THE SIGNAL CHANGES, KNOW.',
      'FROM WARNING TO WORK COMPLETED.',
      'ONE PLATFORM, SIX INSTRUMENTS.',
      'THE PRODUCT, RUNNING NOW.',
      'SEE WHAT IS HAPPENING OUT THERE.',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveAttribute('id', 'about');
    for (const id of ['network', 'capabilities', 'product']) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    // Hero supporting copy and final CTA copy
    expect(screen.getByText('Maintenance before the unexpected.')).toBeInTheDocument();
    expect(screen.getByText('Better-informed maintenance decisions.')).toBeInTheDocument();
  });

  it('links every CTA and nav item to the right destination', () => {
    renderPage();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Product' })).toHaveAttribute('href', '#product');
    expect(within(nav).getByRole('link', { name: 'Network' })).toHaveAttribute('href', '#network');
    expect(within(nav).getByRole('link', { name: 'Capabilities' })).toHaveAttribute('href', '#capabilities');
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute('href', '#about');

    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Launch Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'EXPLORE THE NETWORK' })).toHaveAttribute('href', '#network');
    expect(screen.getByRole('link', { name: 'VIEW LIVE DEMO' })).toHaveAttribute('href', '/demo');
    expect(screen.getByRole('link', { name: 'EXPLORE THE FULL GRID' })).toHaveAttribute('href', '/grid');
    expect(screen.getByRole('link', { name: 'ENTER POWERPULSE' })).toHaveAttribute('href', '/dashboard');

    const caps = screen.getByRole('navigation', { name: 'Capabilities' });
    const hrefs = within(caps)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/dashboard', '/alerts', '/transformers', '/grid', '/maintenance', '/reports']);

    const product = screen.getByRole('navigation', { name: 'Open the application' });
    expect(within(product).getByRole('link', { name: 'Open dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(within(product).getByRole('link', { name: 'Open 3D grid' })).toHaveAttribute('href', '/grid');
  });

  it('derives monitoring numbers from the preview data', () => {
    renderPage();
    expect(screen.getByTestId('metric-temperatureC')).toHaveTextContent('65.0');
    expect(screen.getByTestId('metric-oilLevelPct')).toHaveTextContent('85.0');
    expect(screen.getByTestId('metric-voltageV')).toHaveTextContent('235');
    expect(screen.getByTestId('metric-currentA')).toHaveTextContent('110');
    expect(screen.getByTestId('metric-loadPct')).toHaveTextContent('60.0');
    expect(screen.getByTestId('metric-healthScore')).toHaveTextContent('80');
    expect(screen.getByText('Simulated readings')).toBeInTheDocument();
    // Status board rows come from the same data, attention first
    const board = screen.getByRole('table');
    const codes = within(board)
      .getAllByRole('rowheader')
      .map((c) => c.textContent);
    expect(codes).toEqual(['TX-102', 'TX-101']);
  });

  it('shows dashes and the fallback caption when the preview is unavailable', () => {
    mockHook({ data: undefined, isLoading: false, isError: true, isSuccess: false });
    renderPage();
    for (const f of ['temperatureC', 'oilLevelPct', 'voltageV', 'currentA', 'loadPct', 'healthScore']) {
      expect(screen.getByTestId(`metric-${f}`)).toHaveTextContent('—');
    }
    expect(screen.getAllByText('Live preview unavailable — start the PowerPulse server').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('network-preview')).not.toBeInTheDocument();
  });

  it('uses the pinned fault sequence on desktop with motion enabled', () => {
    setDesktop(true);
    renderPage();
    expect(screen.getByTestId('fault-sequence')).toHaveAttribute('data-mode', 'pinned');
  });

  it('renders a static fault sequence under reduced motion, even on desktop', () => {
    setDesktop(true);
    motionState.reduce = true;
    renderPage();
    const seq = screen.getByTestId('fault-sequence');
    expect(seq).toHaveAttribute('data-mode', 'static');
    for (const t of ['Reading changes', 'Rule matches', 'Alert is created', 'Transformer is highlighted']) {
      expect(within(seq).getByRole('heading', { name: t })).toBeInTheDocument();
    }
    expect(within(seq).getAllByText('temperatureC ≥ warn')).toHaveLength(4);
  });

  it('renders a static fault sequence on mobile', () => {
    renderPage();
    expect(screen.getByTestId('fault-sequence')).toHaveAttribute('data-mode', 'static');
  });

  it('opens the mobile menu, moves focus into it and closes with Escape', () => {
    renderPage();
    const toggle = screen.getByRole('button', { name: 'Menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);

    const dialog = screen.getByRole('dialog', { name: 'Site menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByRole('link', { name: /Product/ })).toHaveAttribute('href', '#product');
    expect(within(dialog).getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });
});
