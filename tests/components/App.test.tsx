import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type MockPendingNavigation = { type: "open-file"; path: string } | null;

const { readMarkdownFile, saveMarkdownFile, scanFolder, selectFolderPath, selectMarkdownFilePath, selectSaveMarkdownPath } =
  vi.hoisted(() => ({
    readMarkdownFile: vi.fn().mockResolvedValue("# Loaded"),
    saveMarkdownFile: vi.fn().mockResolvedValue(undefined),
    scanFolder: vi.fn().mockResolvedValue([]),
    selectFolderPath: vi.fn().mockResolvedValue(null),
    selectMarkdownFilePath: vi.fn().mockResolvedValue(null),
    selectSaveMarkdownPath: vi.fn().mockResolvedValue(null),
  }));

function createMockEditorStore() {
  type Listener = () => void;

  let state = {
    workspacePath: null as string | null,
    tree: [],
    activeDocument: null as { path: string | null; name: string; content: string; isDirty: boolean } | null,
    pendingNavigation: null as MockPendingNavigation,
    errorMessage: null as string | null,
    setWorkspace: (workspacePath: string | null) => {
      state = { ...state, workspacePath };
      notify();
    },
    setActiveDocument: (activeDocument: { path: string | null; name: string; content: string; isDirty: boolean } | null) => {
      state = { ...state, activeDocument };
      notify();
    },
    updateContent: (content: string) => {
      if (!state.activeDocument) {
        return;
      }

      state = {
        ...state,
        activeDocument: {
          ...state.activeDocument,
          content,
          isDirty: true,
        },
      };
      notify();
    },
    setPendingNavigation: (pendingNavigation: MockPendingNavigation) => {
      state = { ...state, pendingNavigation };
      notify();
    },
    clearPendingNavigation: () => {
      state = { ...state, pendingNavigation: null };
      notify();
    },
    clearError: () => {
      state = { ...state, errorMessage: null };
      notify();
    },
    setError: (errorMessage: string) => {
      state = { ...state, errorMessage };
      notify();
    },
  };

  const listeners = new Set<Listener>();

  function notify() {
    listeners.forEach((listener) => listener());
  }

  return {
    getState: () => state,
    getInitialState: () => state,
    setState: (nextState: Partial<typeof state> | ((currentState: typeof state) => Partial<typeof state>)) => {
      const patch = typeof nextState === "function" ? nextState(state) : nextState;
      state = { ...state, ...patch };
      notify();
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

vi.mock("../../src/store/editorStore", async () => {
  const actual = await vi.importActual<typeof import("../../src/store/editorStore")>(
    "../../src/store/editorStore",
  );
  const store = createMockEditorStore();
  (globalThis as typeof globalThis & { __editorStore?: ReturnType<typeof createMockEditorStore> }).__editorStore =
    store;

  return {
    ...actual,
    createEditorStore: () => store,
  };
});

vi.mock("../../src/lib/tauri/fs", () => ({
  readMarkdownFile,
  saveMarkdownFile,
  scanFolder,
  selectFolderPath,
  selectMarkdownFilePath,
  selectSaveMarkdownPath,
}));

vi.mock("../../src/app/AppShell", () => ({
  AppShell: (props: {
    pendingNavigation: MockPendingNavigation;
    onPendingNavigationChange: (pendingNavigation: MockPendingNavigation) => void;
    onSaveAndContinue: () => void;
    onDiscardChanges: () => void;
    onCancelNavigation: () => void;
  }) => (
    <div>
      <div data-testid="pending-navigation">{props.pendingNavigation?.type ?? "none"}</div>
      <button
        type="button"
        onClick={() => props.onPendingNavigationChange({ type: "open-file", path: "/notes/today.md" })}
      >
        Request open
      </button>
      <button type="button" onClick={props.onSaveAndContinue}>
        Save and continue
      </button>
      <button type="button" onClick={props.onDiscardChanges}>
        Discard changes
      </button>
      <button type="button" onClick={props.onCancelNavigation}>
        Cancel
      </button>
    </div>
  ),
}));

import { App } from "../../src/app/App";

describe("App", () => {
  it.each(["Save and continue", "Discard changes", "Cancel"] as const)(
    "clears pending navigation when %s is chosen",
    async (action) => {
      render(<App />);

      screen.getByRole("button", { name: "Request open" }).click();

      expect(await screen.findByText("open-file")).toBeInTheDocument();

      screen.getByRole("button", { name: action }).click();

      await waitFor(() => {
        expect(screen.getByTestId("pending-navigation")).toHaveTextContent("none");
      });

      expect((globalThis as typeof globalThis & { __editorStore?: ReturnType<typeof createMockEditorStore> }).__editorStore?.getState().pendingNavigation).toBeNull();
    },
  );
});
