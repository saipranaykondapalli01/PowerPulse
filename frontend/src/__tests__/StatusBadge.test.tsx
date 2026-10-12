import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeverityBadge, StatusBadge } from '@/components/ui/StatusBadges';
import type { TransformerStatus } from '@/types/api';

describe('StatusBadge', () => {
  it.each<[TransformerStatus, string]>([
    ['HEALTHY', 'Healthy'],
    ['WARNING', 'Warning'],
    ['CRITICAL', 'Critical'],
    ['OFFLINE', 'Offline'],
  ])('renders %s as visible text plus an icon, not color alone', (status, text) => {
    const { container } = render(<StatusBadge value={status} />);
    expect(screen.getByText(text)).toBeVisible();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders severity text', () => {
    render(<SeverityBadge value="HIGH" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});
