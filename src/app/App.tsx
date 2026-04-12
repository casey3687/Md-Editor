import { useMemo } from "react";
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
} from "../lib/tauri/fs";
import type {
  DirectoryNode,
  EditorDocument,
  MarkdownFileEntry,
  PendingNavigation,
  SidebarTab,
} from "../types/editor";

function getDocumentName(path: string | null) {
  if (!path) {
    return "Untitled.md";
  }

  const parts = path.split(/[\\/]/);
  return parts.at(-1) ?? "Untitled.md";
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
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

function isPathWithinWorkspace(path: string, workspacePath: string) {
  const normalizedPath = normalizePath(path).toLowerCase();
  const normalizedWorkspace = normalizePath(workspacePath).replace(/\/$/, "").toLowerCase();
  return normalizedPath === normalizedWorkspace || normalizedPath.startsWith(`${normalizedWorkspace}/`);
}

function createEditorDocument(path: string | null, content: string): EditorDocument {
  return {
    path,
    name: getDocumentName(path),
    content,
    isDirty: false,
    mode: "preview-edit",
    outline: extractMarkdownOutline(content),
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

  const workspacePath = useStore(editorStore, (state) => state.workspacePath);
  const fileEntries = useStore(editorStore, (state) => state.fileEntries);
  const sidebarTab = useStore(editorStore, (state) => state.sidebarTab);
  const activeDocument = useStore(editorStore, (state) => state.activeDocument);
  const pendingNavigation = useStore(editorStore, (state) => state.pendingNavigation);
  const errorMessage = useStore(editorStore, (state) => state.errorMessage);
  const toggleEditorMode = useStore(editorStore, (state) => state.toggleEditorMode);

  useEditorShortcuts(toggleEditorMode);

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

  const loadDocument = async (path: string) => {
    const content = await readMarkdownFile(path);
    editorStore.getState().setActiveDocument(createEditorDocument(path, content));
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
      editorStore.getState().clearError();
    } catch (error) {
      editorStore.getState().setError(error instanceof Error ? error.message : "Failed to open folder");
    }
  };

  const handleSelectFile = async (path: string) => {
    try {
      await loadDocument(path);
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

      await loadDocument(filePath);
      editorStore.getState().clearError();
    } catch (error) {
      editorStore.getState().setError(error instanceof Error ? error.message : "Failed to open file");
    }
  };

  const saveDocument = async (document: EditorDocument, pathOverride?: string) => {
    const currentWorkspacePath = editorStore.getState().workspacePath;
    const nextPath =
      pathOverride ??
      document.path ??
      (await selectSaveMarkdownPath(document.path ?? document.name));

    if (!nextPath) {
      return false;
    }

    await saveMarkdownFile(nextPath, document.content);
    editorStore.getState().setActiveDocument({
      ...document,
      path: nextPath,
      name: getDocumentName(nextPath),
      isDirty: false,
    });
    const nextWorkspacePath =
      currentWorkspacePath && isPathWithinWorkspace(nextPath, currentWorkspacePath)
        ? currentWorkspacePath
        : getParentDirectory(nextPath) ?? currentWorkspacePath;

    await refreshWorkspaceFiles(nextWorkspacePath);
    return true;
  };

  const handleSave = async () => {
    const document = editorStore.getState().activeDocument;
    if (!document) {
      return;
    }

    try {
      await saveDocument(document);
      editorStore.getState().clearError();
    } catch (error) {
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

      await saveDocument(document, path);
      editorStore.getState().clearError();
    } catch (error) {
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

      state.clearPendingNavigation();
      state.clearError();
      await executePendingNavigation(navigation);
    } catch (error) {
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
    editorStore.getState().setActiveOutline(id);
  };

  const handleContentChange = (content: string) => {
    const state = editorStore.getState();
    state.updateContent(content);
    state.setOutline(extractMarkdownOutline(content));
  };

  return (
    <AppShell
      workspacePath={workspacePath}
      fileEntries={fileEntries}
      sidebarTab={sidebarTab}
      activeDocument={activeDocument}
      pendingNavigation={pendingNavigation}
      errorMessage={errorMessage}
      onNewFile={createNewDocument}
      onOpenFile={handleOpenFile}
      onOpenFolder={handleOpenFolder}
      onSave={handleSave}
      onSaveAs={handleSaveAs}
      onSelectFile={handleSelectFile}
      onSidebarTabChange={handleSidebarTabChange}
      onContentChange={handleContentChange}
      onToggleEditorMode={toggleEditorMode}
      onSelectOutline={handleSelectOutline}
      onPendingNavigationChange={(navigation) => editorStore.getState().setPendingNavigation(navigation)}
      onSaveAndContinue={handleSaveAndContinue}
      onDiscardChanges={handleDiscardChanges}
      onCancelNavigation={handleCancelNavigation}
    />
  );
}
