import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readMarkdownFile, selectMarkdownFilePath, getStartupArgs } = vi.hoisted(() => ({
  readMarkdownFile: vi.fn(),
  selectMarkdownFilePath: vi.fn(),
  getStartupArgs: vi.fn(),
}));

vi.mock("../../src/lib/tauri/fs", () => ({
  scanFolder: vi.fn(),
  readMarkdownFile,
  saveMarkdownFile: vi.fn(),
  selectFolderPath: vi.fn(),
  selectMarkdownFilePath,
  selectSaveMarkdownPath: vi.fn(),
  getStartupArgs,
  isMarkdownFile: (path: string) => path.endsWith(".md"),
}));

vi.mock("../../src/lib/markdown/outline", () => ({
  extractMarkdownOutline: vi.fn((content: string) => {
    const startedAt = performance.now();
    while (performance.now() - startedAt < 350) {
      // Simulate expensive outline generation.
    }

    return [
      {
        id: "title-1",
        text: content.includes("Title") ? "Title" : "Untitled section",
        level: 1,
        line: 1,
        anchor: "title",
        isActive: false,
      },
    ];
  }),
}));

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (nextValue: string) => void }) => (
    <textarea aria-label="Markdown editor" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

import { App } from "../../src/app/App";

describe("App open performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the editor shell before slow outline extraction completes", async () => {
    getStartupArgs.mockResolvedValue(["path/to/app.exe"]);
    selectMarkdownFilePath.mockResolvedValue("docs/large.md");
    readMarkdownFile.mockResolvedValue("# Title\n\nLarge content");

    render(<App />);
    const startedAt = performance.now();
    screen.getByRole("button", { name: "Open File" }).click();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Source mode" })).toBeInTheDocument();
    });

    expect(performance.now() - startedAt).toBeLessThan(300);
  });
});
