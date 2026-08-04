import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell, getNextEditorFontSizeForWheel } from "../../src/app/AppShell";
import { App } from "../../src/app/App";

const {
  scanFolder,
  readMarkdownFile,
  saveMarkdownFile,
  selectFolderPath,
  selectMarkdownFilePath,
  selectSaveMarkdownPath,
  getStartupArgs,
  setWindowTheme,
  setWindowTitle,
} = vi.hoisted(() => ({
    scanFolder: vi.fn(),
    readMarkdownFile: vi.fn(),
    saveMarkdownFile: vi.fn(),
    selectFolderPath: vi.fn(),
    selectMarkdownFilePath: vi.fn(),
    selectSaveMarkdownPath: vi.fn(),
    getStartupArgs: vi.fn().mockResolvedValue([]),
    setWindowTheme: vi.fn().mockResolvedValue(undefined),
    setWindowTitle: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setTheme: setWindowTheme,
    setTitle: setWindowTitle,
  }),
}));

vi.mock("../../src/lib/tauri/fs", () => ({
  scanFolder,
  readMarkdownFile,
  saveMarkdownFile,
  selectFolderPath,
  selectMarkdownFilePath,
  selectSaveMarkdownPath,
  getStartupArgs,
  isMarkdownFile: (path: string) => path.endsWith(".md"),
}));

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (nextValue: string) => void }) => (
    <textarea aria-label="Markdown editor" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("requests pending navigation when a dirty action is blocked", () => {
    const onNewFile = vi.fn();
    const onPendingNavigationChange = vi.fn();

    render(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: true,
          mode: "preview-edit",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={onNewFile}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={onPendingNavigationChange}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New" }));

    expect(onNewFile).not.toHaveBeenCalled();
    expect(onPendingNavigationChange).toHaveBeenCalledTimes(1);
    expect(onPendingNavigationChange).toHaveBeenCalledWith({ type: "new-file" });
  });

  it("keeps an appearance toggle in the shell toolbar and switches the document theme", () => {
    render(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: false,
          mode: "preview-edit",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", { name: "白天模式" });
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    fireEvent.click(toggle);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(setWindowTheme).toHaveBeenLastCalledWith("dark");
    expect(screen.getByRole("button", { name: "夜间模式" })).toBeInTheDocument();
  });

  it("keeps a single appearance toggle when a single markdown file is opened without a workspace", () => {
    window.localStorage.setItem("md-editor.appearance", "dark");

    render(
      <AppShell
        workspacePath={null}
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: false,
          mode: "preview-edit",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: "夜间模式" })).toHaveLength(1);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("applies the saved appearance mode from localStorage on mount", async () => {
    window.localStorage.setItem("md-editor.appearance", "dark");

    render(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: false,
          mode: "preview-edit",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    });
    expect(setWindowTheme).toHaveBeenLastCalledWith("dark");
  });

  it("uses the active document name as the native window title when a folder is open", async () => {
    const { rerender } = render(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/drafts/first.md",
          name: "first.md",
          content: "# First",
          isDirty: false,
          mode: "preview-edit",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(setWindowTitle).toHaveBeenLastCalledWith("first.md");
    });

    rerender(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/current.md",
          name: "current.md",
          content: "# Current",
          isDirty: false,
          mode: "preview-edit",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(setWindowTitle).toHaveBeenLastCalledWith("current.md");
    });
  });

  it("shows the current editor mode on the mode button", () => {
    render(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: false,
          mode: "source",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "源码模式" })).toBeInTheDocument();
  });

  it("shows saved status beside the mode control without inserting a banner above the workspace", () => {
    render(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: false,
          mode: "preview-edit",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        statusMessage="saved"
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    const editorPanel = screen.getByLabelText("Markdown editor panel");
    const savedStatus = screen.getByRole("status");

    expect(savedStatus).toHaveTextContent("saved");
    expect(editorPanel).toContainElement(savedStatus);
  });

  it("adjusts and persists the editor font size from settings", () => {
    render(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: false,
          mode: "source",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("\u5b57\u4f53\u5927\u5c0f"), { target: { value: "21" } });

    const editorPanel = screen.getByLabelText("Markdown editor panel");
    expect(editorPanel.querySelector("[style*='--editor-font-size: 21px']")).toBeTruthy();
    expect(window.localStorage.getItem("md-editor.font-size")).toBe("21");
  });

  it("maps ctrl wheel direction to bounded editor font sizes", () => {
    expect(getNextEditorFontSizeForWheel(16, -100)).toBe(17);
    expect(getNextEditorFontSizeForWheel(16, 100)).toBe(15);
    expect(getNextEditorFontSizeForWheel(16, 0)).toBe(16);
    expect(getNextEditorFontSizeForWheel(28, -100)).toBe(28);
    expect(getNextEditorFontSizeForWheel(12, 100)).toBe(12);
  });

  it("changes font size with Ctrl + wheel after the source editor stops bubbling", async () => {
    window.localStorage.setItem("md-editor.font-size", "16");
    render(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: false,
          mode: "source",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    const editor = screen.getByLabelText("Markdown editor");
    editor.addEventListener("wheel", (event) => event.stopPropagation());
    fireEvent.wheel(editor, { ctrlKey: true, deltaY: -100 });

    await waitFor(() => {
      expect(screen.getByLabelText("Markdown editor panel").querySelector("[style*='--editor-font-size: 17px']")).toBeTruthy();
    });
  });
  it("closes settings when clicking outside the settings dialog", () => {
    render(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: false,
          mode: "preview-edit",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const settingsDialog = screen.getByRole("dialog", { name: "Settings" });

    fireEvent.mouseDown(settingsDialog);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();

    fireEvent.mouseDown(settingsDialog.parentElement as HTMLElement);
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("keeps the sidebar locked collapsed in source mode and restores the previous preview layout", () => {
    const { rerender } = render(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: false,
          mode: "preview-edit",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    expect(screen.getByRole("tablist", { name: "Sidebar tabs" })).toBeInTheDocument();

    rerender(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: false,
          mode: "source",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    expect(screen.queryByRole("tablist", { name: "Sidebar tabs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "展开侧边栏" })).not.toBeInTheDocument();

    rerender(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: false,
          mode: "preview-edit",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    expect(screen.getByRole("tablist", { name: "Sidebar tabs" })).toBeInTheDocument();
  });

  it("renders the editable preview surface in preview-edit mode and forwards edits through content changes", () => {
    const onContentChange = vi.fn();

    render(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Title\n\nPlain paragraph.\n\n```ts\nconst value = 1;\n```",
          isDirty: false,
          mode: "preview-edit",
          outline: [],
        }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={onContentChange}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    const wysiwygEditor = screen.getByRole("textbox", { name: "WYSIWYG markdown editor" });
    expect(screen.getByRole("button", { name: "预览模式" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Markdown editor" })).not.toBeInTheDocument();

    wysiwygEditor.innerHTML = "<h1>Updated title</h1><p>Plain paragraph.</p>";
    fireEvent.input(wysiwygEditor);
    fireEvent.blur(wysiwygEditor);

    expect(onContentChange).toHaveBeenCalledWith(expect.stringContaining("# Updated title"));
  });

  it.each([
    ["Save and continue", "onSaveAndContinue"],
    ["Discard changes", "onDiscardChanges"],
    ["Cancel", "onCancelNavigation"],
  ] as const)("calls %s without clearing pending navigation in the shell", (buttonName, callbackName) => {
    const pendingNavigation = { type: "open-file", path: "/workspace/notes/today.md" } as const;
    const onPendingNavigationChange = vi.fn();
    const callbacks = {
      onSaveAndContinue: vi.fn(),
      onDiscardChanges: vi.fn(),
      onCancelNavigation: vi.fn(),
    };

    render(
      <AppShell
        workspacePath="E:/notes"
        fileEntries={[]}
        sidebarTab="files"
        activeDocument={{
          path: "E:/notes/today.md",
          name: "today.md",
          content: "# Notes",
          isDirty: true,
          mode: "preview-edit",
          outline: [],
        }}
        pendingNavigation={pendingNavigation}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onSidebarTabChange={vi.fn()}
        onContentChange={vi.fn()}
        onToggleEditorMode={vi.fn()}
        onSelectOutline={vi.fn()}
        onPendingNavigationChange={onPendingNavigationChange}
        onSaveAndContinue={callbacks.onSaveAndContinue}
        onDiscardChanges={callbacks.onDiscardChanges}
        onCancelNavigation={callbacks.onCancelNavigation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: buttonName }));

    expect(callbacks[callbackName]).toHaveBeenCalledTimes(1);
    expect(onPendingNavigationChange).not.toHaveBeenCalled();
  });

  it("loads a selected markdown file into the editor and preview", async () => {
    selectFolderPath.mockResolvedValue("docs");
    scanFolder.mockResolvedValue([
      {
        path: "docs/a.md",
        relativePath: "a.md",
        name: "a.md",
        directoryLabel: ".",
        excerpt: null,
        modifiedAt: null,
      },
    ]);
    readMarkdownFile.mockResolvedValue("# Loaded");
    saveMarkdownFile.mockResolvedValue(undefined);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: /a\.md/i }));

    expect(await screen.findByRole("heading", { name: "Loaded" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Markdown editor" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "预览模式" })).toBeInTheDocument();
  });

  it("populates the outline from loaded markdown headings", async () => {
    selectFolderPath.mockResolvedValue("docs");
    scanFolder.mockResolvedValue([
      {
        path: "docs/a.md",
        relativePath: "a.md",
        name: "a.md",
        directoryLabel: ".",
        excerpt: null,
        modifiedAt: null,
      },
    ]);
    readMarkdownFile.mockResolvedValue("# Loaded\n\n## Details");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: /a\.md/i }));

    fireEvent.click(screen.getByRole("tab", { name: "Outline" }));

    expect(await screen.findByRole("button", { name: "Loaded" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
  });

  it("toggles mode both directions with Ctrl + /", async () => {
    selectFolderPath.mockResolvedValue("docs");
    scanFolder.mockResolvedValue([
      {
        path: "docs/a.md",
        relativePath: "a.md",
        name: "a.md",
        directoryLabel: ".",
        excerpt: null,
        modifiedAt: null,
      },
    ]);
    readMarkdownFile.mockResolvedValue("# Loaded");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: /a\.md/i }));

    expect(await screen.findByRole("heading", { name: "Loaded" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Markdown editor" })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "/", ctrlKey: true });

    expect(await screen.findByRole("textbox", { name: "Markdown editor" })).toHaveValue("# Loaded");
    expect(screen.getByRole("button", { name: "源码模式" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "/", ctrlKey: true });

    expect(await screen.findByRole("heading", { name: "Loaded" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Markdown editor" })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "/", metaKey: true });

    expect(await screen.findByRole("textbox", { name: "Markdown editor" })).toHaveValue("# Loaded");
    expect(screen.getByRole("button", { name: "源码模式" })).toBeInTheDocument();
  });

  it("shows the source editor with the same document content after switching modes", async () => {
    selectFolderPath.mockResolvedValue("docs");
    scanFolder.mockResolvedValue([
      {
        path: "docs/a.md",
        relativePath: "a.md",
        name: "a.md",
        directoryLabel: ".",
        excerpt: null,
        modifiedAt: null,
      },
    ]);
    readMarkdownFile.mockResolvedValue("# Loaded");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: /a\.md/i }));
    expect(await screen.findByRole("heading", { name: "Loaded" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "预览模式" }));

    expect(await screen.findByRole("textbox", { name: "Markdown editor" })).toHaveValue("# Loaded");
  });

  it("keeps the active document visible when opening a folder fails", async () => {
    selectFolderPath.mockResolvedValueOnce("docs").mockRejectedValueOnce(new Error("folder failed"));
    scanFolder.mockResolvedValue([
      {
        path: "docs/a.md",
        relativePath: "a.md",
        name: "a.md",
        directoryLabel: ".",
        excerpt: null,
        modifiedAt: null,
      },
    ]);
    readMarkdownFile.mockResolvedValue("# Loaded");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: /a\.md/i }));
    expect(await screen.findByRole("heading", { name: "Loaded" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("folder failed");
    });
    expect(screen.getByRole("heading", { name: "Loaded" })).toBeInTheDocument();
  });

  it("keeps the active document visible when opening a file fails", async () => {
    selectMarkdownFilePath
      .mockResolvedValueOnce("docs/a.md")
      .mockResolvedValueOnce("docs/broken.md");
    readMarkdownFile
      .mockResolvedValueOnce("# Loaded")
      .mockRejectedValueOnce(new Error("file failed"));

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open File" }));
    expect(await screen.findByRole("heading", { name: "Loaded" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open File" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("file failed");
    });
    expect(screen.getByRole("heading", { name: "Loaded" })).toBeInTheDocument();
  });

  it("refreshes the workspace tree after saving an untitled document into the open workspace", async () => {
    selectFolderPath.mockResolvedValue("docs");
    selectMarkdownFilePath.mockResolvedValue(null);
    selectSaveMarkdownPath.mockResolvedValue("docs/new-file.md");
    scanFolder
      .mockResolvedValueOnce([
        {
          path: "docs/a.md",
          relativePath: "a.md",
          name: "a.md",
          directoryLabel: ".",
          excerpt: null,
          modifiedAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          path: "docs/a.md",
          relativePath: "a.md",
          name: "a.md",
          directoryLabel: ".",
          excerpt: null,
          modifiedAt: null,
        },
        {
          path: "docs/new-file.md",
          relativePath: "new-file.md",
          name: "new-file.md",
          directoryLabel: ".",
          excerpt: null,
          modifiedAt: null,
        },
      ]);
    saveMarkdownFile.mockResolvedValue(undefined);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    await screen.findByRole("button", { name: /a\.md/i });

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.click(screen.getByRole("button", { name: "预览模式" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Markdown editor" }), {
      target: { value: "# New file" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save As" }));

    await waitFor(() => {
      expect(saveMarkdownFile).toHaveBeenCalledWith("docs/new-file.md", "# New file");
    });
    fireEvent.click(screen.getByRole("button", { name: "源码模式" }));
    expect(await screen.findByRole("button", { name: /new-file\.md/i })).toBeInTheDocument();
  });
});
