import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/app/App";

const {
  scanFolder,
  readMarkdownFile,
  saveMarkdownFile,
  selectFolderPath,
  selectMarkdownFilePath,
  selectSaveMarkdownPath,
} = vi.hoisted(() => ({
  scanFolder: vi.fn(),
  readMarkdownFile: vi.fn(),
  saveMarkdownFile: vi.fn(),
  selectFolderPath: vi.fn(),
  selectMarkdownFilePath: vi.fn(),
  selectSaveMarkdownPath: vi.fn(),
}));

vi.mock("../../src/lib/tauri/fs", () => ({
  scanFolder,
  readMarkdownFile,
  saveMarkdownFile,
  selectFolderPath,
  selectMarkdownFilePath,
  selectSaveMarkdownPath,
  isMarkdownFile: (path: string) => path.endsWith(".md"),
}));

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (nextValue: string) => void }) => (
    <textarea aria-label="Markdown editor" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

describe("UnsavedChangesFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves the dirty document before continuing an open-file navigation", async () => {
    const user = userEvent.setup();

    selectFolderPath.mockResolvedValue("docs");
    scanFolder.mockResolvedValue([{ path: "docs/a.md", name: "a.md", kind: "file" }]);
    selectMarkdownFilePath.mockResolvedValue("docs/b.md");
    readMarkdownFile.mockImplementation(async (path: string) => {
      if (path === "docs/a.md") {
        return "# First";
      }

      if (path === "docs/b.md") {
        return "# Second";
      }

      throw new Error(`unexpected path: ${path}`);
    });
    saveMarkdownFile.mockResolvedValue(undefined);

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(await screen.findByRole("button", { name: "a.md" }));
    await user.clear(screen.getByRole("textbox", { name: "Markdown editor" }));
    await user.type(screen.getByRole("textbox", { name: "Markdown editor" }), "# First updated");
    await user.click(screen.getByRole("button", { name: "Open File" }));

    expect(await screen.findByRole("dialog", { name: "Unsaved changes" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save and continue" }));

    expect(saveMarkdownFile).toHaveBeenCalledWith("docs/a.md", "# First updated");
    expect(readMarkdownFile).toHaveBeenCalledWith("docs/b.md");
    expect(await screen.findByDisplayValue("# Second")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Second" })).toBeInTheDocument();
  });
});
