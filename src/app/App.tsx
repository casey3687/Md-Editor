import { useMemo } from "react";
import { useStore } from "zustand";

import { AppShell } from "./AppShell";
import { createEditorStore } from "../store/editorStore";
import {
  readMarkdownFile,
  saveMarkdownFile,
  scanFolder,
  selectFolderPath,
  selectMarkdownFilePath,
  selectSaveMarkdownPath,
} from "../lib/tauri/fs";
import type { EditorDocument, PendingNavigation } from "../types/editor";

function getDocumentName(path: string | null) {
  if (!path) {
    return "Untitled.md";
  }

  const parts = path.split(/[\\/]/);
  return parts.at(-1) ?? "Untitled.md";
}

export function App() {
  const editorStore = useMemo(() => createEditorStore(), []);

  const workspacePath = useStore(editorStore, (state) => state.workspacePath);
  const tree = useStore(editorStore, (state) => state.tree);
  const activeDocument = useStore(editorStore, (state) => state.activeDocument);
  const pendingNavigation = useStore(editorStore, (state) => state.pendingNavigation);
  const errorMessage = useStore(editorStore, (state) => state.errorMessage);

  const refreshWorkspaceTree = async (path: string | null) => {
    if (!path) {
      return;
    }

    const nodes = await scanFolder(path);
    editorStore.getState().setWorkspace(path, nodes);
  };

  const loadDocument = async (path: string) => {
    const content = await readMarkdownFile(path);
    editorStore.getState().setActiveDocument({
      path,
      name: getDocumentName(path),
      content,
      isDirty: false,
    });
  };

  const createNewDocument = () => {
    editorStore.getState().setActiveDocument({
      path: null,
      name: "Untitled.md",
      content: "",
      isDirty: false,
    });
  };

  const handleOpenFolder = async () => {
    try {
      const folderPath = await selectFolderPath();
      if (!folderPath) {
        return;
      }

      const nodes = await scanFolder(folderPath);
      editorStore.getState().clearError();
      editorStore.getState().setWorkspace(folderPath, nodes);
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
    const workspacePath = editorStore.getState().workspacePath;
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
    await refreshWorkspaceTree(workspacePath);
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

  return (
    <AppShell
      workspacePath={workspacePath}
      tree={tree}
      activeDocument={activeDocument}
      pendingNavigation={pendingNavigation}
      errorMessage={errorMessage}
      onNewFile={createNewDocument}
      onOpenFile={handleOpenFile}
      onOpenFolder={handleOpenFolder}
      onSave={handleSave}
      onSaveAs={handleSaveAs}
      onSelectFile={handleSelectFile}
      onContentChange={(content) => editorStore.getState().updateContent(content)}
      onPendingNavigationChange={(navigation) => editorStore.getState().setPendingNavigation(navigation)}
      onSaveAndContinue={handleSaveAndContinue}
      onDiscardChanges={handleDiscardChanges}
      onCancelNavigation={handleCancelNavigation}
    />
  );
}
