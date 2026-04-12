import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../../src/app/AppShell";
import { App } from "../../src/app/App";

const { scanFolder, readMarkdownFile, saveMarkdownFile, selectFolderPath, selectSaveMarkdownPath } = vi.hoisted(() => ({
  scanFolder: vi.fn(),
  readMarkdownFile: vi.fn(),
  saveMarkdownFile: vi.fn(),
  selectFolderPath: vi.fn(),
  selectSaveMarkdownPath: vi.fn(),
}));

vi.mock("../../src/lib/tauri/fs", () => ({
  scanFolder,
  readMarkdownFile,
  saveMarkdownFile,
  selectFolderPath,
  selectMarkdownFilePath: vi.fn(),
  selectSaveMarkdownPath,
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
        tree={[]}
        activeDocument={{ path: "E:/notes/today.md", name: "today.md", content: "# Notes", isDirty: true }}
        pendingNavigation={null}
        errorMessage={null}
        onNewFile={onNewFile}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onContentChange={vi.fn()}
        onPendingNavigationChange={onPendingNavigationChange}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    screen.getByRole("button", { name: "New" }).click();

    expect(onNewFile).not.toHaveBeenCalled();
    expect(onPendingNavigationChange).toHaveBeenCalledTimes(1);
    expect(onPendingNavigationChange).toHaveBeenCalledWith({ type: "new-file" });
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
        tree={[]}
        activeDocument={{ path: "E:/notes/today.md", name: "today.md", content: "# Notes", isDirty: true }}
        pendingNavigation={pendingNavigation}
        errorMessage={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onSelectFile={vi.fn()}
        onContentChange={vi.fn()}
        onPendingNavigationChange={onPendingNavigationChange}
        onSaveAndContinue={callbacks.onSaveAndContinue}
        onDiscardChanges={callbacks.onDiscardChanges}
        onCancelNavigation={callbacks.onCancelNavigation}
      />,
    );

    screen.getByRole("button", { name: buttonName }).click();

    expect(callbacks[callbackName]).toHaveBeenCalledTimes(1);
    expect(onPendingNavigationChange).not.toHaveBeenCalled();
  });

  it("loads a selected markdown file into the editor and preview", async () => {
    const user = userEvent.setup();
    selectFolderPath.mockResolvedValue("docs");
    scanFolder.mockResolvedValue([{ path: "docs/a.md", name: "a.md", kind: "file" }]);
    readMarkdownFile.mockResolvedValue("# Loaded");
    saveMarkdownFile.mockResolvedValue(undefined);

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(await screen.findByRole("button", { name: "a.md" }));

    expect(await screen.findByDisplayValue("# Loaded")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Loaded" })).toBeInTheDocument();
  });

  it("refreshes the workspace tree after saving an untitled document into the open workspace", async () => {
    const user = userEvent.setup();
    selectFolderPath.mockResolvedValue("docs");
    selectSaveMarkdownPath.mockResolvedValue("docs/new-file.md");
    scanFolder
      .mockResolvedValueOnce([{ path: "docs/a.md", name: "a.md", kind: "file" }])
      .mockResolvedValueOnce([
        { path: "docs/a.md", name: "a.md", kind: "file" },
        { path: "docs/new-file.md", name: "new-file.md", kind: "file" },
      ]);
    saveMarkdownFile.mockResolvedValue(undefined);

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await screen.findByRole("button", { name: "a.md" });

    await user.click(screen.getByRole("button", { name: "New" }));
    await user.type(screen.getByRole("textbox", { name: "Markdown editor" }), "# New file");
    await user.click(screen.getByRole("button", { name: "Save As" }));

    expect(saveMarkdownFile).toHaveBeenCalledWith("docs/new-file.md", "# New file");
    expect(await screen.findByRole("button", { name: "new-file.md" })).toBeInTheDocument();
  });
});
