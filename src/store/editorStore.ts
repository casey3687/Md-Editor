import { createStore } from "zustand/vanilla";

import type {
  EditorDocument,
  MarkdownFileEntry,
  OutlineItem,
  PendingNavigation,
  SidebarTab,
} from "../types/editor";

function cloneFileEntry(entry: MarkdownFileEntry): MarkdownFileEntry {
  return { ...entry };
}

function cloneOutlineItem(item: OutlineItem): OutlineItem {
  return { ...item };
}

function cloneEditorDocument(document: EditorDocument): EditorDocument {
  return {
    ...document,
    outline: document.outline.map(cloneOutlineItem),
  };
}

type EditorState = {
  workspacePath: string | null;
  fileEntries: MarkdownFileEntry[];
  sidebarTab: SidebarTab;
  activeDocument: EditorDocument | null;
  pendingNavigation: PendingNavigation;
  errorMessage: string | null;
  setFileEntries: (entries: MarkdownFileEntry[]) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  toggleEditorMode: () => void;
  setOutline: (outline: OutlineItem[]) => void;
  setActiveOutline: (id: string | null) => void;
  setActiveDocument: (document: EditorDocument | null) => void;
  updateContent: (content: string) => void;
  setPendingNavigation: (pending: PendingNavigation) => void;
  clearPendingNavigation: () => void;
  clearError: () => void;
  setError: (message: string) => void;
};

export function createEditorStore() {
  return createStore<EditorState>((set) => ({
    workspacePath: null,
    fileEntries: [],
    sidebarTab: "files",
    activeDocument: null,
    pendingNavigation: null,
    errorMessage: null,
    setFileEntries: (fileEntries) =>
      set({
        fileEntries: fileEntries.map(cloneFileEntry),
      }),
    setSidebarTab: (sidebarTab) => set({ sidebarTab }),
    toggleEditorMode: () =>
      set((state) => {
        if (!state.activeDocument) {
          return state;
        }

        return {
          activeDocument: {
            ...state.activeDocument,
            mode: state.activeDocument.mode === "preview-edit" ? "source" : "preview-edit",
          },
        };
      }),
    setOutline: (outline) =>
      set((state) => {
        if (!state.activeDocument) {
          return state;
        }

        const activeOutlineTargets = new Set<string>();
        state.activeDocument.outline.forEach((item) => {
          if (item.isActive) {
            activeOutlineTargets.add(item.id);
            activeOutlineTargets.add(item.anchor);
          }
        });

        return {
          activeDocument: {
            ...state.activeDocument,
            outline: outline.map((item) => {
              const nextOutlineItem = cloneOutlineItem(item);

              if (activeOutlineTargets.has(nextOutlineItem.id) || activeOutlineTargets.has(nextOutlineItem.anchor)) {
                nextOutlineItem.isActive = true;
              }

              return nextOutlineItem;
            }),
          },
        };
      }),
    setActiveOutline: (id) =>
      set((state) => {
        if (!state.activeDocument) {
          return state;
        }

        return {
          activeDocument: {
            ...state.activeDocument,
            outline: state.activeDocument.outline.map((item) => ({
              ...item,
              isActive: id !== null && item.id === id,
            })),
          },
        };
      }),
    setActiveDocument: (activeDocument) =>
      set({
        activeDocument: activeDocument ? cloneEditorDocument(activeDocument) : null,
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
    clearPendingNavigation: () =>
      set({
        pendingNavigation: null,
      }),
    clearError: () => set({ errorMessage: null }),
    setError: (errorMessage) => set({ errorMessage }),
  }));
}
