import { createStore } from "zustand/vanilla";

import type {
  DirectoryNode,
  EditorDocument,
  PendingNavigation,
} from "../types/editor";

function cloneDirectoryNode(node: DirectoryNode): DirectoryNode {
  if (node.kind === "file") {
    return { ...node };
  }

  return {
    ...node,
    children: node.children.map(cloneDirectoryNode),
  };
}

type EditorState = {
  workspacePath: string | null;
  tree: DirectoryNode[];
  activeDocument: EditorDocument | null;
  pendingNavigation: PendingNavigation;
  errorMessage: string | null;
  setWorkspace: (path: string | null, tree: DirectoryNode[]) => void;
  setActiveDocument: (document: EditorDocument | null) => void;
  updateContent: (content: string) => void;
  setPendingNavigation: (pending: PendingNavigation) => void;
  clearError: () => void;
  setError: (message: string) => void;
};

export function createEditorStore() {
  return createStore<EditorState>((set) => ({
    workspacePath: null,
    tree: [],
    activeDocument: null,
    pendingNavigation: null,
    errorMessage: null,
    setWorkspace: (workspacePath, tree) =>
      set({
        workspacePath,
        tree: tree.map(cloneDirectoryNode),
      }),
    setActiveDocument: (activeDocument) =>
      set({
        activeDocument: activeDocument ? { ...activeDocument } : null,
      }),
    updateContent: (content) =>
      set((state) => {
        if (!state.activeDocument) {
          return state;
        }

        if (state.activeDocument.content === content) {
          return state;
        }

        return {
          activeDocument: {
            ...state.activeDocument,
            content,
            isDirty: true,
          },
        };
      }),
    setPendingNavigation: (pendingNavigation) =>
      set({
        pendingNavigation: pendingNavigation ? { ...pendingNavigation } : null,
      }),
    clearError: () => set({ errorMessage: null }),
    setError: (errorMessage) => set({ errorMessage }),
  }));
}
