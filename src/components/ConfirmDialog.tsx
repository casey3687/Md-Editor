import type { PendingNavigation } from "../types/editor";
import styles from "./ConfirmDialog.module.css";

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
    <div className={styles.backdrop}>
      <div role="dialog" aria-modal="true" aria-label="Unsaved changes" className={styles.dialog}>
        <h2 className={styles.title}>Unsaved changes</h2>
        <p className={styles.message}>You have unsaved changes. Do you want to save before you {pendingNavigationLabel}?</p>
        <div className={styles.actions}>
          <button type="button" aria-label="Save and continue" className={styles.primaryButton} onClick={onSaveAndContinue}>
            保存并继续
          </button>
          <button type="button" aria-label="Discard changes" className={styles.secondaryButton} onClick={onDiscardChanges}>
            放弃修改
          </button>
          <button type="button" aria-label="Cancel" className={styles.secondaryButton} onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
