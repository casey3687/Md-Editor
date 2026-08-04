import styles from "./Toolbar.module.css";

type ToolbarProps = {
  disableSave: boolean;
  appearanceMode?: "light" | "dark";
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenSettings?: () => void;
  onToggleAppearance?: () => void;
};

export function Toolbar({
  disableSave,
  appearanceMode = "light",
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAs,
  onOpenSettings,
  onToggleAppearance,
}: ToolbarProps) {
  const isDarkMode = appearanceMode === "dark";

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
      <button type="button" aria-label="Settings" onClick={onOpenSettings} className={styles.button}>
        {"\u8bbe\u7f6e"}
      </button>
      <button
        type="button"
        aria-label={isDarkMode ? "夜间模式" : "白天模式"}
        aria-pressed={isDarkMode}
        onClick={onToggleAppearance}
        className={[styles.button, styles.appearanceButton].join(" ")}
      >
        {isDarkMode ? "夜间模式" : "白天模式"}
      </button>
    </nav>
  );
}
