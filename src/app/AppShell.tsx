import { WelcomeView } from "./WelcomeView";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MarkdownEditor } from "../features/editor/MarkdownEditor";
import { PreviewEditableSurface } from "../features/preview/PreviewEditableSurface";
import { WorkspaceSidebar } from "../features/workspace/WorkspaceSidebar";
import { Toolbar } from "../features/toolbar/Toolbar";
import styles from "./AppShell.module.css";
import type {
  EditorDocument,
  MarkdownFileEntry,
  PendingNavigation,
  SidebarTab,
} from "../types/editor";

type AppShellProps = {
  workspacePath: string | null;
  fileEntries: MarkdownFileEntry[];
  sidebarTab: SidebarTab;
  activeDocument: EditorDocument | null;
  pendingNavigation: PendingNavigation;
  errorMessage: string | null;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSelectFile: (path: string) => void;
  onSidebarTabChange: (tab: SidebarTab) => void;
  onContentChange: (content: string) => void;
  onToggleEditorMode: () => void;
  onSelectOutline: (id: string) => void;
  onPendingNavigationChange: (pendingNavigation: PendingNavigation) => void;
  onSaveAndContinue: () => void;
  onDiscardChanges: () => void;
  onCancelNavigation: () => void;
};

export function AppShell({
  workspacePath,
  fileEntries,
  sidebarTab,
  activeDocument,
  pendingNavigation,
  errorMessage,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAs,
  onSelectFile,
  onSidebarTabChange,
  onContentChange,
  onToggleEditorMode,
  onSelectOutline,
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

  const outline = activeDocument?.outline ?? [];

  return (
    <main className={styles.shell}>
      <Toolbar
        disableSave={!hasActiveDocument}
        onNewFile={() => requestNavigation({ type: "new-file" }, onNewFile)}
        onOpenFile={() => requestNavigation({ type: "open-file", path: "" }, onOpenFile)}
        onOpenFolder={() => requestNavigation({ type: "open-folder", path: "" }, onOpenFolder)}
        onSave={onSave}
        onSaveAs={onSaveAs}
      />
      {errorMessage ? (
        <p role="alert" className={styles.errorBanner}>
          {errorMessage}
        </p>
      ) : null}
      <section aria-label="Workspace shell" className={styles.workspaceShell}>
        <WorkspaceSidebar
          workspacePath={workspacePath}
          fileEntries={fileEntries}
          sidebarTab={sidebarTab}
          activePath={activeDocument?.path ?? null}
          outline={outline}
          onSidebarTabChange={onSidebarTabChange}
          onSelectFile={(path) => requestNavigation({ type: "open-file", path }, () => onSelectFile(path))}
          onSelectOutline={onSelectOutline}
        />
        <section aria-label="Markdown editor panel" className={styles.editorPanel}>
          {hasActiveDocument ? (
            <div className={styles.editorHeader}>
              <button type="button" onClick={onToggleEditorMode} className={styles.editorModeButton}>
                {activeDocument?.mode === "preview-edit" ? "Source mode" : "Preview edit mode"}
              </button>
            </div>
          ) : null}
          <div className={styles.editorSurface}>
            {activeDocument?.mode === "source" ? (
              <MarkdownEditor content={activeDocument?.content ?? ""} onChange={onContentChange} />
            ) : (
              <PreviewEditableSurface
                content={activeDocument?.content ?? ""}
                onContentChange={onContentChange}
              />
            )}
          </div>
        </section>
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
