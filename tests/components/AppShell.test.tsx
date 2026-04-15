import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../../src/app/AppShell";
import { App } from "../../src/app/App";

const { scanFolder, readMarkdownFile, saveMarkdownFile, selectFolderPath, selectMarkdownFilePath, selectSaveMarkdownPath, getStartupArgs } =
  vi.hoisted(() => ({
    scanFolder: vi.fn(),
    readMarkdownFile: vi.fn(),
    saveMarkdownFile: vi.fn(),
    selectFolderPath: vi.fn(),
    selectMarkdownFilePath: vi.fn(),
    selectSaveMarkdownPath: vi.fn(),
    getStartupArgs: vi.fn().mockResolvedValue([]),
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
    expect(screen.getByRole("button", { name: "Source mode" })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Source mode" })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Preview edit mode" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "/", ctrlKey: true });

    expect(await screen.findByRole("heading", { name: "Loaded" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Markdown editor" })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "/", metaKey: true });

    expect(await screen.findByRole("textbox", { name: "Markdown editor" })).toHaveValue("# Loaded");
    expect(screen.getByRole("button", { name: "Preview edit mode" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Source mode" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Source mode" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Markdown editor" }), {
      target: { value: "# New file" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save As" }));

    await waitFor(() => {
      expect(saveMarkdownFile).toHaveBeenCalledWith("docs/new-file.md", "# New file");
    });
    expect(await screen.findByRole("button", { name: /new-file\.md/i })).toBeInTheDocument();
  });
});
