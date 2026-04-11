import type { PendingNavigation } from "../types/editor";

type ConfirmDialogProps = {
  open: boolean;
  pendingNavigation: PendingNavigation;
  onSaveAndContinue: () => void;
  onDiscardChanges: () => void;
  onCancel: () => void;
};

function getPendingNavigationLabel(pendingNavigation: PendingNavigation) {
  switch (pendingNavigation?.type) {
    case "open-file":
      return "open file";
    case "open-folder":
      return "open folder";
    case "new-file":
      return "create a new file";
    default:
      return "navigate away";
  }
}

export function ConfirmDialog({
  open,
  pendingNavigation,
  onSaveAndContinue,
  onDiscardChanges,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const pendingNavigationLabel = getPendingNavigationLabel(pendingNavigation);

  return (
    <div role="dialog" aria-modal="true" aria-label="Unsaved changes">
      <h2>Unsaved changes</h2>
      <p>You have unsaved changes. Do you want to save before you {pendingNavigationLabel}?</p>
      <button type="button" onClick={onSaveAndContinue}>
        Save and continue
      </button>
      <button type="button" onClick={onDiscardChanges}>
        Discard changes
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
