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
    <nav aria-label="Editor toolbar">
      <button type="button" onClick={onNewFile}>
        New
      </button>
      <button type="button" onClick={onOpenFile}>
        Open File
      </button>
      <button type="button" onClick={onOpenFolder}>
        Open Folder
      </button>
      <button type="button" onClick={onSave} disabled={disableSave}>
        Save
      </button>
      <button type="button" onClick={onSaveAs}>
        Save As
      </button>
    </nav>
  );
}
