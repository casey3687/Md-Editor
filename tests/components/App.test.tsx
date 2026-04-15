import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/app/App";
import { createEditorStore } from "../../src/store/editorStore";

const {
  scanFolder,
  readMarkdownFile,
  saveMarkdownFile,
  selectFolderPath,
  selectMarkdownFilePath,
  selectSaveMarkdownPath,
  getStartupArgs,
} = vi.hoisted(() => ({
  scanFolder: vi.fn(),
  readMarkdownFile: vi.fn(),
  saveMarkdownFile: vi.fn(),
  selectFolderPath: vi.fn(),
  selectMarkdownFilePath: vi.fn(),
  selectSaveMarkdownPath: vi.fn(),
  getStartupArgs: vi.fn(),
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

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a markdown file automatically if passed as a startup argument", async () => {
    getStartupArgs.mockResolvedValue(["path/to/app.exe", "path/to/my-file.md"]);
    readMarkdownFile.mockResolvedValue("# Hello from args");
    scanFolder.mockResolvedValue([]); // To avoid errors if it tries to load workspace

    render(<App />);

    await waitFor(() => {
      expect(readMarkdownFile).toHaveBeenCalledWith("path/to/my-file.md");
    });
    
    // We expect the text editor to contain the loaded text
    // The wysiwyg editor content contains the parsed HTML
    await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "WYSIWYG markdown editor" })).toBeInTheDocument();
    });
    
    expect(screen.getByRole("textbox", { name: "WYSIWYG markdown editor" }).innerHTML).toContain("Hello from args");
  });
});
