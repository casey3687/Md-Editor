import { WelcomeView } from "./WelcomeView";
import { Toolbar } from "../features/toolbar/Toolbar";

type AppShellProps = {
  workspacePath: string | null;
  hasActiveDocument: boolean;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
};

export function AppShell({
  workspacePath,
  hasActiveDocument,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAs,
}: AppShellProps) {
  if (!workspacePath && !hasActiveDocument) {
    return <WelcomeView onOpenFolder={onOpenFolder} onOpenFile={onOpenFile} />;
  }

  return (
    <main>
      <Toolbar
        disableSave={!hasActiveDocument}
        onNewFile={onNewFile}
        onOpenFile={onOpenFile}
        onOpenFolder={onOpenFolder}
        onSave={onSave}
        onSaveAs={onSaveAs}
      />
      <section aria-label="Workspace shell">
        {workspacePath ? <p>Workspace loaded: {workspacePath}</p> : <p>Workspace ready</p>}
      </section>
    </main>
  );
}
