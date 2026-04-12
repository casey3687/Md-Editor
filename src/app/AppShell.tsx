import { WelcomeView } from "./WelcomeView";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MarkdownEditor } from "../features/editor/MarkdownEditor";
import { FileTree } from "../features/file-tree/FileTree";
import { MarkdownPreview } from "../features/preview/MarkdownPreview";
import { Toolbar } from "../features/toolbar/Toolbar";
import type { DirectoryNode, EditorDocument, PendingNavigation } from "../types/editor";

type AppShellProps = {
  workspacePath: string | null;
  tree: DirectoryNode[];
  activeDocument: EditorDocument | null;
  pendingNavigation: PendingNavigation;
  errorMessage: string | null;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSelectFile: (path: string) => void;
  onContentChange: (content: string) => void;
  onPendingNavigationChange: (pendingNavigation: PendingNavigation) => void;
  onSaveAndContinue: () => void;
  onDiscardChanges: () => void;
  onCancelNavigation: () => void;
};

export function AppShell({
  workspacePath,
  tree,
  activeDocument,
  pendingNavigation,
  errorMessage,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAs,
  onSelectFile,
  onContentChange,
  onPendingNavigationChange,
  onSaveAndContinue,
  onDiscardChanges,
  onCancelNavigation,
}: AppShellProps) {
  const hasActiveDocument = activeDocument !== null;
  const isDirtyDocument = activeDocument?.isDirty ?? false;

  const requestNavigation = (navigation: Exclude<PendingNavigation, null>, action: () => void) => {
    if (isDirtyDocument) {
      onPendingNavigationChange(navigation);
      return;
    }

    action();
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
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <section aria-label="Workspace shell">
        <aside aria-label="Workspace files">
          {workspacePath ? <p>Workspace loaded: {workspacePath}</p> : <p>Workspace ready</p>}
          <FileTree
            nodes={tree}
            activePath={activeDocument?.path ?? null}
            onSelectFile={(path) => requestNavigation({ type: "open-file", path }, () => onSelectFile(path))}
          />
        </aside>
        <section aria-label="Markdown editor panel">
          <MarkdownEditor content={activeDocument?.content ?? ""} onChange={onContentChange} />
        </section>
        <aside aria-label="Markdown preview panel">
          <MarkdownPreview content={activeDocument?.content ?? ""} />
        </aside>
      </section>
      <ConfirmDialog
        open={pendingNavigation !== null}
        pendingNavigation={pendingNavigation}
        onSaveAndContinue={onSaveAndContinue}
        onDiscardChanges={onDiscardChanges}
        onCancel={onCancelNavigation}
      />
    </main>
  );
}
