import styles from "./Toolbar.module.css";

type ToolbarProps = {
  disableSave: boolean;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
};

export function Toolbar({
  disableSave,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAs,
}: ToolbarProps) {
  return (
    <nav aria-label="Editor toolbar" className={styles.toolbar}>
      <button type="button" onClick={onNewFile} className={styles.button}>
        New
      </button>
      <button type="button" onClick={onOpenFile} className={styles.button}>
        Open File
      </button>
      <button type="button" onClick={onOpenFolder} className={styles.button}>
        Open Folder
      </button>
      <button type="button" onClick={onSave} disabled={disableSave} className={styles.button}>
        Save
      </button>
      <button type="button" onClick={onSaveAs} className={styles.button}>
        Save As
      </button>
    </nav>
  );
}
