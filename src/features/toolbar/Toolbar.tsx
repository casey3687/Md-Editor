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
      <button type="button" aria-label="New" onClick={onNewFile} className={styles.button}>
        新建
      </button>
      <button type="button" aria-label="Open File" onClick={onOpenFile} className={styles.button}>
        打开文件
      </button>
      <button type="button" aria-label="Open Folder" onClick={onOpenFolder} className={styles.button}>
        打开文件夹
      </button>
      <button type="button" aria-label="Save" onClick={onSave} disabled={disableSave} className={styles.button}>
        保存
      </button>
      <button type="button" aria-label="Save As" onClick={onSaveAs} className={styles.button}>
        另存为
      </button>
    </nav>
  );
}
