import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

function renderDialog(onConfirm: (reason: string) => unknown, onClose = vi.fn()) {
  render(
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={onConfirm}
      tone="danger"
      title="Cancel task"
      description="Cancelled tasks cannot be reopened."
      confirmLabel="Cancel task"
      cancelLabel="Keep task"
      reason={{ label: 'Reason', required: true, minLength: 3, maxLength: 20, requiredMessage: 'A cancellation reason is required' }}
    />,
  );
  return { onClose };
}

describe('ConfirmDialog', () => {
  it('requires a reason before confirming, then passes the trimmed reason', async () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    const dialog = screen.getByRole('dialog', { name: 'Cancel task' });
    expect(dialog).toHaveTextContent('This cannot be undone.');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel task' }));
    expect(await screen.findByText('A cancellation reason is required')).toBeInTheDocument();
    expect(screen.getByLabelText(/reason/i)).toHaveAttribute('aria-invalid', 'true');
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/reason/i), 'ab');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel task' }));
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/reason/i), 'c duplicate  ');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel task' }));
    expect(onConfirm).toHaveBeenCalledWith('abc duplicate');
  });

  it('rejects reasons over the maximum length', async () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    await userEvent.type(screen.getByLabelText(/reason/i), 'x'.repeat(21));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel task' }));
    expect(await screen.findByText('Reason must be at most 20 characters')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('stays busy and blocks double submits and dismissal until the promise settles', async () => {
    let finish: () => void = () => {};
    const onConfirm = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const { onClose } = renderDialog(onConfirm);
    await userEvent.type(screen.getByLabelText(/reason/i), 'Duplicate');
    const confirm = screen.getByRole('button', { name: 'Cancel task' });
    await userEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Keep task' })).toBeDisabled();
    await userEvent.click(confirm);
    await userEvent.keyboard('{Escape}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(confirm).not.toBeDisabled());
  });
});
