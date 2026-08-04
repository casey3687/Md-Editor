import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { WelcomeView } from "./WelcomeView";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { StartupLoadingView } from "./StartupLoadingView";
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

const APPEARANCE_STORAGE_KEY = "md-editor.appearance";
const FONT_SIZE_STORAGE_KEY = "md-editor.font-size";
const DEFAULT_WINDOW_TITLE = "Markdown Editor";
const DEFAULT_EDITOR_FONT_SIZE = 16;
const MIN_EDITOR_FONT_SIZE = 12;
const MAX_EDITOR_FONT_SIZE = 28;

type FontSizeWheelEvent = {
  ctrlKey: boolean;
  deltaY: number;
  preventDefault: () => void;
  __mdEditorFontSizeHandled?: boolean;
};

function clampEditorFontSize(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_EDITOR_FONT_SIZE;
  }

  return Math.min(MAX_EDITOR_FONT_SIZE, Math.max(MIN_EDITOR_FONT_SIZE, Math.round(value)));
}

export function getNextEditorFontSizeForWheel(currentFontSize: number, deltaY: number) {
  if (deltaY < 0) {
    return clampEditorFontSize(currentFontSize + 1);
  }

  if (deltaY > 0) {
    return clampEditorFontSize(currentFontSize - 1);
  }

  return clampEditorFontSize(currentFontSize);
}

type AppShellProps = {
  workspacePath: string | null;
  fileEntries: MarkdownFileEntry[];
  sidebarTab: SidebarTab;
  activeDocument: EditorDocument | null;
  pendingNavigation: PendingNavigation;
  errorMessage: string | null;
  statusMessage?: string | null;
  isDocumentOpening?: boolean;
  showLoadingMessage?: boolean;
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
  isDocumentOpening = false,
  showLoadingMessage = false,
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
  const [appearanceMode, setAppearanceMode] = useState<"light" | "dark">(() => {
    try {
      const saved = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
      if (saved === "dark" || saved === "light") {
        return saved;
      }
    } catch {
      // localStorage unavailable; use default
    }
    return "light";
  });
  const [editorFontSize, setEditorFontSize] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem(FONT_SIZE_STORAGE_KEY));
      if (Number.isFinite(saved)) {
        return clampEditorFontSize(saved);
      }
    } catch {
      // localStorage unavailable; use default
    }
    return DEFAULT_EDITOR_FONT_SIZE;
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null);
  const editorFontSizeRef = useRef(editorFontSize);

  useEffect(() => {
    if (appearanceMode === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }

    void getCurrentWindow().setTheme(appearanceMode).catch(() => undefined);
  }, [appearanceMode]);

  useEffect(() => {
    const windowTitle = activeDocument?.name ?? DEFAULT_WINDOW_TITLE;
    document.title = windowTitle;
    void getCurrentWindow().setTitle(windowTitle).catch(() => undefined);
  }, [activeDocument?.name]);

  const handleToggleAppearance = useCallback(() => {
    setAppearanceMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(APPEARANCE_STORAGE_KEY, next);
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  const updateEditorFontSize = useCallback((nextValue: number) => {
    const nextFontSize = clampEditorFontSize(nextValue);
    setEditorFontSize(nextFontSize);
    try {
      window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(nextFontSize));
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    editorFontSizeRef.current = editorFontSize;
  }, [editorFontSize]);

  const handleEditorFontSizeWheel = useCallback(
    (event: FontSizeWheelEvent) => {
      if (event.__mdEditorFontSizeHandled || !event.ctrlKey) {
        return;
      }

      event.__mdEditorFontSizeHandled = true;
      event.preventDefault();
      const nextFontSize = getNextEditorFontSizeForWheel(editorFontSizeRef.current, event.deltaY);
      if (nextFontSize !== editorFontSizeRef.current) {
        updateEditorFontSize(nextFontSize);
      }
    },
    [updateEditorFontSize],
  );

  useLayoutEffect(() => {
    const editorSurface = editorSurfaceRef.current;
    if (!editorSurface) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      handleEditorFontSizeWheel(event as FontSizeWheelEvent);
    };

    editorSurface.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () => {
      editorSurface.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, [handleEditorFontSizeWheel]);

  const hasActiveDocument = activeDocument !== null;
  const isDirtyDocument = activeDocument?.isDirty ?? false;
  const editorFontStyle = {
    "--editor-font-size": `${editorFontSize}px`,
  } as CSSProperties;

  const requestNavigation = (navigation: Exclude<PendingNavigation, null>, action: () => void) => {
    if (isDirtyDocument) {
      onPendingNavigationChange(navigation);
      return;
    }

    action();
  };

  if (!workspacePath && !hasActiveDocument) {
    if (isDocumentOpening) {
      return <StartupLoadingView showMessage={showLoadingMessage} />;
    }

    return <WelcomeView onOpenFolder={onOpenFolder} onOpenFile={onOpenFile} />;
  }

  const outline = activeDocument?.outline ?? [];
  const isSourceMode = activeDocument?.mode === "source";
  const isSidebarLockedCollapsed = isSourceMode;
  const isEffectiveSidebarCollapsed = isSidebarLockedCollapsed || isSidebarCollapsed;
  const editorModeLabel = activeDocument?.mode === "preview-edit" ? "预览模式" : "源码模式";

  return (
    <main className={styles.shell}>
      <Toolbar
        disableSave={!hasActiveDocument}
        appearanceMode={appearanceMode}
        onNewFile={() => requestNavigation({ type: "new-file" }, onNewFile)}
        onOpenFile={() => requestNavigation({ type: "open-file", path: "" }, onOpenFile)}
        onOpenFolder={() => requestNavigation({ type: "open-folder", path: "" }, onOpenFolder)}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleAppearance={handleToggleAppearance}
      />
      {errorMessage ? (
        <p role="alert" className={styles.errorBanner}>
          {errorMessage}
        </p>
      ) : null}
      <section
        aria-label="Workspace shell"
        className={`${styles.workspaceShell} ${isEffectiveSidebarCollapsed ? styles.workspaceShellSidebarCollapsed : ""}`}
      >
        <WorkspaceSidebar
          workspacePath={workspacePath}
          fileEntries={fileEntries}
          sidebarTab={sidebarTab}
          activePath={activeDocument?.path ?? null}
          outline={outline}
          visibleOutlineIds={visibleOutlineIds}
          isCollapsed={isEffectiveSidebarCollapsed}
          onToggleCollapsed={
            isSidebarLockedCollapsed ? undefined : () => setIsSidebarCollapsed((prev) => !prev)
          }
          onSidebarTabChange={onSidebarTabChange}
          onSelectFile={(path) => requestNavigation({ type: "open-file", path }, () => onSelectFile(path))}
          onSelectOutline={onSelectOutline}
        />
        <section aria-label="Markdown editor panel" className={styles.editorPanel}>
          {hasActiveDocument ? (
            <div className={styles.editorHeader}>
              <button
                type="button"
                aria-label={editorModeLabel}
                onClick={onToggleEditorMode}
                className={styles.editorModeButton}
              >
                {editorModeLabel}
              </button>
              {!errorMessage && statusMessage ? (
                <p role="status" className={styles.inlineStatus}>
                  {statusMessage}
                </p>
              ) : null}
            </div>
          ) : null}
          <div
            ref={editorSurfaceRef}
            className={styles.editorSurface}
            style={editorFontStyle}
            onWheel={(event) => handleEditorFontSizeWheel(event.nativeEvent as FontSizeWheelEvent)}
          >
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
      {isSettingsOpen ? (
        <div className={styles.settingsBackdrop} role="presentation" onMouseDown={() => setIsSettingsOpen(false)}>
          <section
            className={styles.settingsDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.settingsHeader}>
              <h2 className={styles.settingsTitle}>{"\u8bbe\u7f6e"}</h2>
              <button type="button" className={styles.settingsButton} onClick={() => setIsSettingsOpen(false)}>
                {"\u5173\u95ed"}
              </button>
            </div>
            <div className={styles.settingRow}>
              <div>
                <label htmlFor="editor-font-size" className={styles.settingLabel}>
                  {"\u5b57\u4f53\u5927\u5c0f"}
                </label>
              </div>
              <div className={styles.fontSizeControls}>
                <div className={styles.fontSizeMainControls}>
                  <button
                    type="button"
                    className={[styles.settingsButton, styles.iconSettingsButton].join(" ")}
                    aria-label="Decrease font size"
                    onClick={() => updateEditorFontSize(editorFontSize - 1)}
                  >
                    -
                  </button>
                  <input
                    id="editor-font-size"
                    className={styles.fontSizeRange}
                    type="range"
                    min={MIN_EDITOR_FONT_SIZE}
                    max={MAX_EDITOR_FONT_SIZE}
                    step={1}
                    value={editorFontSize}
                    onChange={(event) => updateEditorFontSize(Number(event.currentTarget.value))}
                  />
                  <output className={styles.fontSizeValue} htmlFor="editor-font-size" aria-label="Current font size">
                    {editorFontSize}px
                  </output>
                  <button
                    type="button"
                    className={[styles.settingsButton, styles.iconSettingsButton].join(" ")}
                    aria-label="Increase font size"
                    onClick={() => updateEditorFontSize(editorFontSize + 1)}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className={styles.settingsButton}
                  onClick={() => updateEditorFontSize(DEFAULT_EDITOR_FONT_SIZE)}
                >
                  {"\u91cd\u7f6e"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
