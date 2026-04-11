import { WelcomeView } from "./WelcomeView";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Toolbar } from "../features/toolbar/Toolbar";
import type { PendingNavigation } from "../types/editor";

type AppShellProps = {
  workspacePath: string | null;
  hasActiveDocument: boolean;
  isDirtyDocument: boolean;
  pendingNavigation: PendingNavigation;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onPendingNavigationChange: (pendingNavigation: PendingNavigation) => void;
  onSaveAndContinue: (pendingNavigation: Exclude<PendingNavigation, null>) => void;
  onDiscardChanges: (pendingNavigation: Exclude<PendingNavigation, null>) => void;
  onCancelNavigation: () => void;
};

export function AppShell({
  workspacePath,
  hasActiveDocument,
  isDirtyDocument,
  pendingNavigation,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAs,
  onPendingNavigationChange,
  onSaveAndContinue,
  onDiscardChanges,
  onCancelNavigation,
}: AppShellProps) {
  const requestNavigation = (navigation: Exclude<PendingNavigation, null>, action: () => void) => {
    if (isDirtyDocument) {
      onPendingNavigationChange(navigation);
      return;
    }

    action();
  };

  const closePendingNavigation = () => {
    onPendingNavigationChange(null);
    onCancelNavigation();
  };

  if (!workspacePath && !hasActiveDocument) {
    return <WelcomeView onOpenFolder={onOpenFolder} onOpenFile={onOpenFile} />;
  }

  return (
    <main>
      <Toolbar
        disableSave={!hasActiveDocument}
        onNewFile={() => requestNavigation({ type: "new-file" }, onNewFile)}
        onOpenFile={() => requestNavigation({ type: "open-file", path: "" }, onOpenFile)}
        onOpenFolder={() => requestNavigation({ type: "open-folder", path: "" }, onOpenFolder)}
        onSave={onSave}
        onSaveAs={onSaveAs}
      />
      <section aria-label="Workspace shell">
        {workspacePath ? <p>Workspace loaded: {workspacePath}</p> : <p>Workspace ready</p>}
      </section>
      <ConfirmDialog
        open={pendingNavigation !== null}
        pendingNavigation={pendingNavigation}
        onSaveAndContinue={() => {
          if (!pendingNavigation) {
            return;
          }

          onSaveAndContinue(pendingNavigation);
          onPendingNavigationChange(null);
        }}
        onDiscardChanges={() => {
          if (!pendingNavigation) {
            return;
          }

          onDiscardChanges(pendingNavigation);
          onPendingNavigationChange(null);
        }}
        onCancel={closePendingNavigation}
      />
    </main>
  );
}
