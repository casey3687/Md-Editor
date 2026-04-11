type WelcomeViewProps = {
  onOpenFolder: () => void;
  onOpenFile: () => void;
};

export function WelcomeView({ onOpenFolder, onOpenFile }: WelcomeViewProps) {
  return (
    <section>
      <h1>Markdown Editor</h1>
      <button type="button" onClick={onOpenFolder}>
        Open Folder
      </button>
      <button type="button" onClick={onOpenFile}>
        Open File
      </button>
    </section>
  );
}