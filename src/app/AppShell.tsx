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
  statusMessage?: string | null;
  outlineJump?: { line: number; token: number } | null;
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
  onSurfaceScrollRatioChange?: (ratio: number) => void;
  onViewportLineChange?: (line: number) => void;
  onViewportRangeChange?: (startLine: number, endLine: number) => void;
  visibleOutlineIds?: string[];
  surfaceScrollRatio?: number;
  surfaceScrollToken?: number | null;
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
  statusMessage = null,
  outlineJump = null,
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
  onSurfaceScrollRatioChange,
  onViewportLineChange,
  onViewportRangeChange,
  visibleOutlineIds = [],
  surfaceScrollRatio = 0,
  surfaceScrollToken = null,
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
      {!errorMessage && statusMessage ? (
        <p role="status" className={styles.successBanner}>
          {statusMessage}
        </p>
      ) : null}
      <section aria-label="Workspace shell" className={styles.workspaceShell}>
        <WorkspaceSidebar
          workspacePath={workspacePath}
          fileEntries={fileEntries}
          sidebarTab={sidebarTab}
          activePath={activeDocument?.path ?? null}
          outline={outline}
          visibleOutlineIds={visibleOutlineIds}
          onSidebarTabChange={onSidebarTabChange}
          onSelectFile={(path) => requestNavigation({ type: "open-file", path }, () => onSelectFile(path))}
          onSelectOutline={onSelectOutline}
        />
        <section aria-label="Markdown editor panel" className={styles.editorPanel}>
          {hasActiveDocument ? (
            <div className={styles.editorHeader}>
              <button
                type="button"
                aria-label={activeDocument?.mode === "preview-edit" ? "Source mode" : "Preview edit mode"}
                onClick={onToggleEditorMode}
                className={styles.editorModeButton}
              >
                {activeDocument?.mode === "preview-edit" ? "源码模式" : "预览编辑模式"}
              </button>
            </div>
          ) : null}
          <div className={styles.editorSurface}>
            {activeDocument?.mode === "source" ? (
              <MarkdownEditor
                content={activeDocument?.content ?? ""}
                onChange={onContentChange}
                jumpToLine={outlineJump?.line ?? null}
                jumpToken={outlineJump?.token ?? null}
                onScrollRatioChange={onSurfaceScrollRatioChange}
                onViewportLineChange={onViewportLineChange}
                onViewportRangeChange={onViewportRangeChange}
                scrollRatio={surfaceScrollRatio}
                scrollToken={surfaceScrollToken}
              />
            ) : (
              <PreviewEditableSurface
                content={activeDocument?.content ?? ""}
                documentPath={activeDocument?.path ?? null}
                onContentChange={onContentChange}
                jumpToLine={outlineJump?.line ?? null}
                jumpToken={outlineJump?.token ?? null}
                onScrollRatioChange={onSurfaceScrollRatioChange}
                onViewportLineChange={onViewportLineChange}
                onViewportRangeChange={onViewportRangeChange}
                scrollRatio={surfaceScrollRatio}
                scrollToken={surfaceScrollToken}
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
