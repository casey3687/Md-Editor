import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type MockPendingNavigation = { type: "new-file" } | null;

type MockEditorDocument = {
  path: string | null;
  name: string;
  content: string;
  isDirty: boolean;
  mode: "preview-edit" | "source";
  outline: Array<{
    id: string;
    text: string;
    level: number;
    line: number;
    anchor: string;
    isActive: boolean;
  }>;
};

type MockEditorStoreState = {
  workspacePath: string | null;
  fileEntries: [];
  sidebarTab: "files";
  activeDocument: MockEditorDocument;
  pendingNavigation: MockPendingNavigation;
  errorMessage: string | null;
  setFileEntries: ReturnType<typeof vi.fn>;
  setSidebarTab: ReturnType<typeof vi.fn>;
  toggleEditorMode: ReturnType<typeof vi.fn>;
  setOutline: ReturnType<typeof vi.fn>;
  setActiveOutline: ReturnType<typeof vi.fn>;
  setActiveDocument: ReturnType<typeof vi.fn>;
  updateContent: ReturnType<typeof vi.fn>;
  setPendingNavigation: (pendingNavigation: MockPendingNavigation) => void;
  clearPendingNavigation: () => void;
  clearError: () => void;
  setError: (errorMessage: string) => void;
  setState: (
    nextState: Partial<MockEditorStoreState> | ((currentState: MockEditorStoreState) => Partial<MockEditorStoreState>),
  ) => void;
};

function createMockEditorStore() {
  type Listener = () => void;

  let state: MockEditorStoreState = {
    workspacePath: "docs" as string | null,
    fileEntries: [],
    sidebarTab: "files" as const,
    activeDocument: {
      path: "docs/a.md" as string | null,
      name: "a.md",
      content: "# First",
      isDirty: true,
      mode: "preview-edit" as const,
      outline: [],
    },
    pendingNavigation: { type: "new-file" } as MockPendingNavigation,
    errorMessage: null as string | null,
    setFileEntries: vi.fn(),
    setSidebarTab: vi.fn(),
    toggleEditorMode: vi.fn(),
    setOutline: vi.fn(),
    setActiveOutline: vi.fn(),
    setActiveDocument: vi.fn(() => {
      throw new Error("navigation failed");
    }),
    updateContent: vi.fn(),
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
    setState: (
      nextState: Partial<MockEditorStoreState> | ((currentState: MockEditorStoreState) => Partial<MockEditorStoreState>),
    ) => {
      const patch = typeof nextState === "function" ? nextState(state) : nextState;
      state = { ...state, ...patch };
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
    setState: (
      nextState: Partial<MockEditorStoreState> | ((currentState: MockEditorStoreState) => Partial<MockEditorStoreState>),
    ) => {
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

  return {
    ...actual,
    createEditorStore: () => createMockEditorStore(),
  };
});

vi.mock("../../src/lib/tauri/fs", () => ({
  readMarkdownFile: vi.fn(),
  saveMarkdownFile: vi.fn(),
  scanFolder: vi.fn(),
  selectFolderPath: vi.fn(),
  selectMarkdownFilePath: vi.fn(),
  selectSaveMarkdownPath: vi.fn(),
}));

vi.mock("../../src/app/AppShell", () => ({
  AppShell: (props: {
    errorMessage: string | null;
    pendingNavigation: MockPendingNavigation;
    onDiscardChanges: () => Promise<void>;
  }) => (
    <div>
      <div data-testid="pending-navigation">{props.pendingNavigation?.type ?? "none"}</div>
      {props.errorMessage ? <p role="alert">{props.errorMessage}</p> : null}
      <button type="button" onClick={() => void props.onDiscardChanges()}>
        Discard changes
      </button>
    </div>
  ),
}));

import { App } from "../../src/app/App";

describe("App error handling", () => {
  it("surfaces an error when discard-and-continue hits an uncaught navigation failure", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("navigation failed");
    });
  });
});
