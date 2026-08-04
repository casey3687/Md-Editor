import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import { AppShell } from "./AppShell";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { createEditorStore } from "../store/editorStore";
import { extractMarkdownOutline } from "../lib/markdown/outline";
import {
  readMarkdownFile,
  saveMarkdownFile,
  scanFolder,
  selectFolderPath,
  selectMarkdownFilePath,
  selectSaveMarkdownPath,
  getStartupArgs,
  isMarkdownFile,
} from "../lib/tauri/fs";
import type {
  DirectoryNode,
  EditorMode,
  EditorDocument,
  MarkdownFileEntry,
  PendingNavigation,
  SidebarTab,
} from "../types/editor";

const FILE_LOADING_INDICATOR_DELAY_MS = 180;
const INITIAL_OUTLINE_REFRESH_DELAY_MS = 250;
const LARGE_DOCUMENT_SOURCE_MODE_THRESHOLD = 200_000;
const LAST_OPENED_FILE_STORAGE_KEY = "md-editor.last-opened-file";

function waitForNextAnimationFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}

function getDocumentName(path: string | null) {
  if (!path) {
    return "Untitled.md";
  }

  const parts = path.split(/[\\/]/);
  return parts.at(-1) ?? "Untitled.md";
}

function getInitialEditorMode(content: string): EditorMode {
  return content.length >= LARGE_DOCUMENT_SOURCE_MODE_THRESHOLD || content.includes("\uFFFD")
    ? "source"
    : "preview-edit";
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
}

function loadLastOpenedFilePath() {
  const savedPath = window.localStorage.getItem(LAST_OPENED_FILE_STORAGE_KEY);
  return savedPath && isMarkdownFile(savedPath) ? savedPath : null;
}

function saveLastOpenedFilePath(path: string) {
  if (!isMarkdownFile(path)) {
    return;
  }

  window.localStorage.setItem(LAST_OPENED_FILE_STORAGE_KEY, path);
}

function clearLastOpenedFilePath(path?: string | null) {
  const savedPath = window.localStorage.getItem(LAST_OPENED_FILE_STORAGE_KEY);
  if (!path || savedPath === path) {
    window.localStorage.removeItem(LAST_OPENED_FILE_STORAGE_KEY);
  }
}

function getRelativePath(path: string, workspacePath: string) {
  const normalizedPath = normalizePath(path);
  const normalizedWorkspace = normalizePath(workspacePath).replace(/\/$/, "");

  if (normalizedPath === normalizedWorkspace) {
    return "";
  }

  if (normalizedPath.startsWith(`${normalizedWorkspace}/`)) {
    return normalizedPath.slice(normalizedWorkspace.length + 1);
  }

  return normalizedPath;
}

function getParentDirectory(path: string) {
  const normalizedPath = normalizePath(path);
  const lastSlashIndex = normalizedPath.lastIndexOf("/");

  if (lastSlashIndex === -1) {
    return null;
  }

  return normalizedPath.slice(0, lastSlashIndex) || null;
}

function getDirectoryLabel(path: string) {
  return getParentDirectory(path) ?? ".";
}

function getExcerpt(content: string) {
  const firstContentLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstContentLine) {
    return null;
  }

  const excerpt = [...firstContentLine].slice(0, 180).join("");
  return firstContentLine.length > excerpt.length ? `${excerpt}...` : excerpt;
}

function isPathWithinWorkspace(path: string, workspacePath: string) {
  const normalizedPath = normalizePath(path).toLowerCase();
  const normalizedWorkspace = normalizePath(workspacePath).replace(/\/$/, "").toLowerCase();
  return normalizedPath === normalizedWorkspace || normalizedPath.startsWith(`${normalizedWorkspace}/`);
}

function createEditorDocument(path: string | null, content: string, outline = [] as EditorDocument["outline"]): EditorDocument {
  return {
    path,
    name: getDocumentName(path),
    content,
    isDirty: false,
    mode: getInitialEditorMode(content),
    outline,
  };
}

function flattenDirectoryNodes(
  nodes: DirectoryNode[],
  workspacePath: string,
  parentSegments: string[] = [],
): MarkdownFileEntry[] {
  return nodes.flatMap((node) => {
    if (node.kind === "file") {
      const relativePath = getRelativePath(node.path, workspacePath);
      return [
        {
          path: node.path,
          relativePath,
          name: node.name,
          directoryLabel: parentSegments.length ? parentSegments.join("/") : ".",
          excerpt: null,
          modifiedAt: null,
        },
      ];
    }

    return flattenDirectoryNodes(node.children, workspacePath, [...parentSegments, node.name]);
  });
}

function isDirectoryNode(node: unknown): node is DirectoryNode {
  if (!node || typeof node !== "object") {
    return false;
  }

  const candidate = node as Partial<DirectoryNode>;
  return typeof candidate.path === "string" && typeof candidate.name === "string" && typeof candidate.kind === "string";
}

function isMarkdownFileEntry(entry: unknown): entry is MarkdownFileEntry {
  if (!entry || typeof entry !== "object") {
    return false;
  }

  const candidate = entry as Partial<MarkdownFileEntry>;
  return (
    typeof candidate.path === "string" &&
    typeof candidate.relativePath === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.directoryLabel === "string"
  );
}

function normalizeScannedEntries(scanned: unknown, workspacePath: string): MarkdownFileEntry[] {
  if (!Array.isArray(scanned)) {
    return [];
  }

  if (scanned.every(isMarkdownFileEntry)) {
    return [...scanned]
      .map((entry) => ({
        ...entry,
        relativePath: normalizePath(entry.relativePath),
        directoryLabel: entry.directoryLabel || ".",
      }))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  }

  if (scanned.every(isDirectoryNode)) {
    return flattenDirectoryNodes(scanned, workspacePath);
  }

  return [];
}

export function App() {
  const editorStore = useMemo(() => createEditorStore(), []);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDocumentOpening, setIsDocumentOpening] = useState(false);
  const [showLoadingMessage, setShowLoadingMessage] = useState(false);
  const [outlineJump, setOutlineJump] = useState<{ line: number; token: number } | null>(null);
  const [surfaceScrollRatio, setSurfaceScrollRatio] = useState(0);
  const [surfaceScrollToken, setSurfaceScrollToken] = useState<number | null>(null);
  const [viewportRange, setViewportRange] = useState<{ startLine: number; endLine: number } | null>(null);
  const [activeOutlineId, setActiveOutlineId] = useState<string | null>(null);
  const clearStatusTimerRef = useRef<number | null>(null);
  const loadingIndicatorTimerRef = useRef<number | null>(null);
  const loadingIndicatorTokenRef = useRef(0);
  const outlineRefreshTimerRef = useRef<number | null>(null);
  const outlineRefreshTokenRef = useRef(0);
  const currentViewportLineRef = useRef<number | null>(null);

  const workspacePath = useStore(editorStore, (state) => state.workspacePath);
  const fileEntries = useStore(editorStore, (state) => state.fileEntries);
  const sidebarTab = useStore(editorStore, (state) => state.sidebarTab);
  const activeDocument = useStore(editorStore, (state) => state.activeDocument);
  const pendingNavigation = useStore(editorStore, (state) => state.pendingNavigation);
  const errorMessage = useStore(editorStore, (state) => state.errorMessage);
  const toggleEditorMode = useStore(editorStore, (state) => state.toggleEditorMode);

  const handleToggleEditorMode = () => {
    const token = Date.now();
    const viewportLine = currentViewportLineRef.current;


    if (viewportLine === null) {
      setSurfaceScrollToken(token);
    } else {
      setSurfaceScrollToken(null);
    }

    if (currentViewportLineRef.current !== null) {
      setOutlineJump({
        line: currentViewportLineRef.current,
        token,
      });
    }
    setViewportRange(null);
    toggleEditorMode();
  };

  useEffect(() => {
    return () => {
      if (clearStatusTimerRef.current !== null) {
        window.clearTimeout(clearStatusTimerRef.current);
      }

      if (loadingIndicatorTimerRef.current !== null) {
        window.clearTimeout(loadingIndicatorTimerRef.current);
      }

      if (outlineRefreshTimerRef.current !== null) {
        window.clearTimeout(outlineRefreshTimerRef.current);
      }
    };
  }, []);

  const scheduleOutlineRefresh = (path: string | null, content: string, delayMs = 0) => {
    outlineRefreshTokenRef.current += 1;
    const currentToken = outlineRefreshTokenRef.current;

    if (outlineRefreshTimerRef.current !== null) {
      window.clearTimeout(outlineRefreshTimerRef.current);
    }

    outlineRefreshTimerRef.current = window.setTimeout(() => {
      outlineRefreshTimerRef.current = null;
      const outline = extractMarkdownOutline(content);
      const state = editorStore.getState();
      const activeDocumentState = state.activeDocument;

      if (outlineRefreshTokenRef.current !== currentToken || !activeDocumentState) {
        return;
      }

      if (activeDocumentState.path !== path || activeDocumentState.content !== content) {
        return;
      }

      startTransition(() => {
        state.setOutline(outline);
      });
    }, delayMs);
  };

  const startDelayedLoadingMessage = () => {
    loadingIndicatorTokenRef.current += 1;
    const currentToken = loadingIndicatorTokenRef.current;

    if (loadingIndicatorTimerRef.current !== null) {
      window.clearTimeout(loadingIndicatorTimerRef.current);
    }

    loadingIndicatorTimerRef.current = window.setTimeout(() => {
      if (loadingIndicatorTokenRef.current !== currentToken) {
        return;
      }

      setShowLoadingMessage(true);
    }, FILE_LOADING_INDICATOR_DELAY_MS);

    return currentToken;
  };

  const clearLoadingMessage = (token: number) => {
    if (loadingIndicatorTokenRef.current !== token) {
      return;
    }

    if (loadingIndicatorTimerRef.current !== null) {
      window.clearTimeout(loadingIndicatorTimerRef.current);
      loadingIndicatorTimerRef.current = null;
    }

    setShowLoadingMessage(false);
  };

  const loadDocumentWithIndicator = async (path: string) => {
    const token = startDelayedLoadingMessage();
    const state = editorStore.getState();
    const transitioningFromWelcome = !state.workspacePath && !state.activeDocument;

    setIsDocumentOpening(true);

    if (transitioningFromWelcome) {
      await waitForNextAnimationFrame();
    }

    try {
      await loadDocument(path);
      editorStore.getState().setSidebarTab("outline");
    } finally {
      clearLoadingMessage(token);
      setIsDocumentOpening(false);
    }
  };

  useEffect(() => {
    const openStartupFileFromArgs = async () => {
      try {
        // Typically the first argument is the executable path, and subsequent arguments are passed files/flags.
        // We look for the first valid markdown file path.
        const args = await getStartupArgs();
        const targetPath = args.find((arg) => isMarkdownFile(arg)) ?? loadLastOpenedFilePath();
        if (!targetPath) {
          return;
        }

        try {
          await loadDocumentWithIndicator(targetPath);
          editorStore.getState().clearError();
        } catch (error) {
          if (!args.find((arg) => isMarkdownFile(arg))) {
            clearLastOpenedFilePath(targetPath);
            console.warn("Failed to reopen last opened markdown file:", error);
            return;
          }

          throw error;
        }
      } catch (error) {
        console.error("Failed to read startup arguments:", error);
      }
    };

    void openStartupFileFromArgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSavedStatus = (path: string) => {
    if (clearStatusTimerRef.current !== null) {
      window.clearTimeout(clearStatusTimerRef.current);
    }

    setStatusMessage(`Saved ${getDocumentName(path)}`);
    clearStatusTimerRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      clearStatusTimerRef.current = null;
    }, 2200);
  };

  const refreshWorkspaceFiles = async (path: string | null) => {
    if (!path) {
      return;
    }

    const scannedEntries = (await scanFolder(path)) as unknown;
    const entries = normalizeScannedEntries(scannedEntries, path);
    const state = editorStore.getState() as ReturnType<typeof editorStore.getState> & {
      setFileEntries?:
        | ((nextEntries: MarkdownFileEntry[]) => void)
        | ((workspacePath: string | null, nextEntries: MarkdownFileEntry[]) => void);
    };

    if (typeof state.setFileEntries === "function") {
      if (state.setFileEntries.length >= 2) {
        (state.setFileEntries as (workspacePath: string | null, nextEntries: MarkdownFileEntry[]) => void)(
          path,
          entries,
        );
      } else {
        (state.setFileEntries as (nextEntries: MarkdownFileEntry[]) => void)(entries);
        editorStore.setState({ workspacePath: path });
      }
      return;
    }

    editorStore.setState({
      workspacePath: path,
      fileEntries: entries,
    });
  };

  const syncActiveDocumentWithWorkspace = (nextWorkspacePath: string) => {
    const state = editorStore.getState();
    const activePath = state.activeDocument?.path;

    if (!activePath || isPathWithinWorkspace(activePath, nextWorkspacePath)) {
      return;
    }

    state.setActiveDocument(null);
  };

  const updateWorkspaceEntryAfterSave = (path: string, content: string) => {
    const state = editorStore.getState();
    const currentWorkspacePath = state.workspacePath;
    const parentDirectory = getParentDirectory(path);
    const nextWorkspacePath =
      currentWorkspacePath && isPathWithinWorkspace(path, currentWorkspacePath)
        ? currentWorkspacePath
        : parentDirectory;

    if (!nextWorkspacePath) {
      return;
    }

    const relativePath = getRelativePath(path, nextWorkspacePath);
    const normalizedPath = normalizePath(path);
    const nextEntry: MarkdownFileEntry = {
      path,
      relativePath,
      name: getDocumentName(path),
      directoryLabel: getDirectoryLabel(relativePath),
      excerpt: getExcerpt(content),
      modifiedAt: Date.now(),
    };
    const existingEntries = nextWorkspacePath === currentWorkspacePath ? state.fileEntries : [];
    const nextEntries = [...existingEntries.filter((entry) => normalizePath(entry.path) !== normalizedPath), nextEntry].sort(
      (left, right) => left.relativePath.localeCompare(right.relativePath),
    );

    editorStore.setState({
      workspacePath: nextWorkspacePath,
      fileEntries: nextEntries,
    });
  };

  const loadDocument = async (path: string) => {
    const content = await readMarkdownFile(path);
    editorStore.getState().setActiveDocument(createEditorDocument(path, content));
    saveLastOpenedFilePath(path);
    scheduleOutlineRefresh(path, content, INITIAL_OUTLINE_REFRESH_DELAY_MS);
  };

  const createNewDocument = () => {
    editorStore.getState().setActiveDocument(createEditorDocument(null, ""));
  };

  const handleOpenFolder = async () => {
    try {
      const folderPath = await selectFolderPath();
      if (!folderPath) {
        return;
      }

      await refreshWorkspaceFiles(folderPath);
      syncActiveDocumentWithWorkspace(folderPath);
      editorStore.getState().setSidebarTab("files");
      editorStore.getState().clearError();
    } catch (error) {
      editorStore.getState().setError(error instanceof Error ? error.message : "Failed to open folder");
    }
  };

  const handleSelectFile = async (path: string) => {
    try {
      await loadDocumentWithIndicator(path);
      editorStore.getState().clearError();
    } catch (error) {
      editorStore.getState().setError(error instanceof Error ? error.message : "Failed to open file");
    }
  };

  const handleOpenFile = async () => {
    try {
      const filePath = await selectMarkdownFilePath();
      if (!filePath) {
        return;
      }

      await loadDocumentWithIndicator(filePath);
      editorStore.getState().clearError();
    } catch (error) {
      editorStore.getState().setError(error instanceof Error ? error.message : "Failed to open file");
    }
  };

  const saveDocument = async (document: EditorDocument, pathOverride?: string): Promise<string | null> => {
    const nextPath =
      pathOverride ??
      document.path ??
      (await selectSaveMarkdownPath(document.path ?? document.name));

    if (!nextPath) {
      return null;
    }

    await saveMarkdownFile(nextPath, document.content);
    editorStore.getState().setActiveDocument({
      ...document,
      path: nextPath,
      name: getDocumentName(nextPath),
      isDirty: false,
    });
    saveLastOpenedFilePath(nextPath);
    updateWorkspaceEntryAfterSave(nextPath, document.content);
    return nextPath;
  };

  const handleSave = async () => {
    const document = editorStore.getState().activeDocument;
    if (!document) {
      return;
    }

    try {
      const savedPath = await saveDocument(document);
      if (savedPath) {
        showSavedStatus(savedPath);
      }
      editorStore.getState().clearError();
    } catch (error) {
      setStatusMessage(null);
      editorStore.getState().setError(error instanceof Error ? error.message : "Failed to save file");
    }
  };

  const handleSaveAs = async () => {
    const document = editorStore.getState().activeDocument;
    if (!document) {
      return;
    }

    try {
      const path = await selectSaveMarkdownPath(document.path ?? document.name);
      if (!path) {
        return;
      }

      const savedPath = await saveDocument(document, path);
      if (savedPath) {
        showSavedStatus(savedPath);
      }
      editorStore.getState().clearError();
    } catch (error) {
      setStatusMessage(null);
      editorStore.getState().setError(error instanceof Error ? error.message : "Failed to save file");
    }
  };

  const executePendingNavigation = async (navigation: Exclude<PendingNavigation, null>) => {
    if (navigation.type === "new-file") {
      createNewDocument();
      return;
    }

    if (navigation.type === "open-file" && navigation.path) {
      await handleSelectFile(navigation.path);
      return;
    }

    if (navigation.type === "open-file") {
      await handleOpenFile();
      return;
    }

    await handleOpenFolder();
  };

  const handleSaveAndContinue = async () => {
    const state = editorStore.getState();
    const document = state.activeDocument;
    const navigation = state.pendingNavigation;

    if (!document || !navigation) {
      state.clearPendingNavigation();
      return;
    }

    try {
      const didSave = await saveDocument(document);
      if (!didSave) {
        return;
      }

      showSavedStatus(didSave);
      state.clearPendingNavigation();
      state.clearError();
      await executePendingNavigation(navigation);
    } catch (error) {
      setStatusMessage(null);
      editorStore.getState().setError(error instanceof Error ? error.message : "Failed to continue after save");
    }
  };

  const handleDiscardChanges = async () => {
    const navigation = editorStore.getState().pendingNavigation;
    editorStore.getState().clearPendingNavigation();

    if (!navigation) {
      return;
    }

    try {
      await executePendingNavigation(navigation);
    } catch (error) {
      editorStore.getState().setError(
        error instanceof Error ? error.message : "Failed to continue after discarding changes",
      );
    }
  };

  const handleCancelNavigation = () => {
    editorStore.getState().clearPendingNavigation();
  };

  const handleSidebarTabChange = (tab: SidebarTab) => {
    editorStore.getState().setSidebarTab(tab);
  };

  const handleSelectOutline = (id: string) => {
    const state = editorStore.getState();
    const target = state.activeDocument?.outline.find((item) => item.id === id);
    state.setActiveOutline(id);
    setActiveOutlineId(id);
    setViewportRange(null);

    if (!target) {
      return;
    }

    setOutlineJump({
      line: target.line,
      token: Date.now(),
    });
  };

  const handleViewportRangeChange = useCallback((startLine: number, endLine: number) => {
    const normalizedStart = Math.max(1, Math.min(startLine, endLine));
    const normalizedEnd = Math.max(normalizedStart, Math.max(startLine, endLine));

    setViewportRange((previous) => {
      if (previous?.startLine === normalizedStart && previous?.endLine === normalizedEnd) {
        return previous;
      }

      return {
        startLine: normalizedStart,
        endLine: normalizedEnd,
      };
    });
  }, []);

  const handleViewportLineChange = useCallback((line: number) => {
    const normalizedLine = Math.max(1, line);
    currentViewportLineRef.current = normalizedLine;
    const state = editorStore.getState();
    const outline = state.activeDocument?.outline ?? [];

    if (outline.length === 0) {
      return;
    }

    let activeId: string | null = null;
    for (const item of outline) {
      if (item.line <= line) {
        activeId = item.id;
      } else {
        break;
      }
    }

    if (!activeId) {
      activeId = outline.at(0)?.id ?? null;
    }

    if (!activeId) {
      return;
    }

    setActiveOutlineId(activeId);
    const currentActiveId = outline.find((item) => item.isActive)?.id ?? null;
    if (currentActiveId === activeId) {
      return;
    }

    state.setActiveOutline(activeId);
  }, [editorStore]);

  useEditorShortcuts({
    onToggleEditorMode: handleToggleEditorMode,
    onNewFile: createNewDocument,
    onOpenFile: handleOpenFile,
    onOpenFolder: handleOpenFolder,
    onSave: handleSave,
    onSaveAs: handleSaveAs,
  });

  const visibleOutlineIds = useMemo(() => {
    if (!activeDocument || !viewportRange) {
      return activeOutlineId ? [activeOutlineId] : [];
    }

    const ids = activeDocument.outline
      .filter((item) => item.line >= viewportRange.startLine && item.line <= viewportRange.endLine)
      .map((item) => item.id);

    if (ids.length > 0) {
      return ids;
    }

    return activeOutlineId ? [activeOutlineId] : [];
  }, [activeDocument, viewportRange, activeOutlineId]);

  useEffect(() => {
    const currentActive = activeDocument?.outline.find((item) => item.isActive)?.id ?? null;
    setActiveOutlineId(currentActive);
    setViewportRange(null);
  }, [activeDocument?.path, activeDocument?.mode]);

  const handleContentChange = (content: string) => {
    const state = editorStore.getState();
    state.updateContent(content);
    scheduleOutlineRefresh(state.activeDocument?.path ?? null, content, 120);
  };

  return (
    <AppShell
      workspacePath={workspacePath}
      fileEntries={fileEntries}
      sidebarTab={sidebarTab}
      activeDocument={activeDocument}
      pendingNavigation={pendingNavigation}
      errorMessage={errorMessage}
      statusMessage={statusMessage}
      isDocumentOpening={isDocumentOpening}
      showLoadingMessage={showLoadingMessage}
      outlineJump={outlineJump}
      onNewFile={createNewDocument}
      onOpenFile={handleOpenFile}
      onOpenFolder={handleOpenFolder}
      onSave={handleSave}
      onSaveAs={handleSaveAs}
      onSelectFile={handleSelectFile}
      onSidebarTabChange={handleSidebarTabChange}
      onContentChange={handleContentChange}
      onToggleEditorMode={handleToggleEditorMode}
      onSelectOutline={handleSelectOutline}
      onSurfaceScrollRatioChange={setSurfaceScrollRatio}
      onViewportLineChange={handleViewportLineChange}
      onViewportRangeChange={handleViewportRangeChange}
      visibleOutlineIds={visibleOutlineIds}
      surfaceScrollRatio={surfaceScrollRatio}
      surfaceScrollToken={surfaceScrollToken}
      onPendingNavigationChange={(navigation) => editorStore.getState().setPendingNavigation(navigation)}
      onSaveAndContinue={handleSaveAndContinue}
      onDiscardChanges={handleDiscardChanges}
      onCancelNavigation={handleCancelNavigation}
    />
  );
}
