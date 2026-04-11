import { createStore } from "zustand/vanilla";

import type {
  DirectoryNode,
  EditorDocument,
  PendingNavigation,
} from "../types/editor";

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
    setWorkspace: (workspacePath, tree) => set({ workspacePath, tree }),
    setActiveDocument: (activeDocument) => set({ activeDocument }),
    updateContent: (content) =>
      set((state) => ({
        activeDocument: state.activeDocument
          ? { ...state.activeDocument, content, isDirty: true }
          : null,
      })),
    setPendingNavigation: (pendingNavigation) =>
      set({ pendingNavigation }),
    clearError: () => set({ errorMessage: null }),
    setError: (errorMessage) => set({ errorMessage }),
  }));
}
