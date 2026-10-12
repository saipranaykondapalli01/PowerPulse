import { useNavigate } from 'react-router-dom';
import { useCreateTransformer, useLocations, useUpdateTransformer } from '@/hooks/useMonitoring';
import type { TransformerDto } from '@/types/api';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { links } from '@/utils/links';
import { TransformerForm } from './TransformerForm';

export interface TransformerFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Present → edit mode. */
  transformer?: TransformerDto;
}

/** Register (create) or edit a transformer in a dialog. On create, navigates to the new transformer. */
export function TransformerFormDialog({ open, onClose, transformer }: TransformerFormDialogProps) {
  const create = useCreateTransformer();
  const update = useUpdateTransformer(transformer?.id ?? '');
  const locations = useLocations();
  const toast = useToast();
  const navigate = useNavigate();
  const editing = !!transformer;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Edit ${transformer.code}` : 'Register transformer'}
      description={
        editing
          ? 'Update registry details. Health and status are recalculated by the server.'
          : 'Add a transformer to the registry. It will appear on the grid once readings arrive.'
      }
      dismissible={!create.isPending && !update.isPending}
    >
      <TransformerForm
        mode={editing ? 'edit' : 'create'}
        initial={transformer}
        locations={locations.data}
        onCancel={onClose}
        onSubmit={async (body) => {
          if (editing) {
            await update.mutateAsync(body);
            toast.success('Transformer updated', `${body.code} saved.`);
            onClose();
          } else {
            const created = await create.mutateAsync(body);
            toast.success('Transformer registered', `${created.code} added to the registry.`);
            onClose();
            navigate(links.transformer(created.id));
          }
        }}
      />
    </Dialog>
  );
}
