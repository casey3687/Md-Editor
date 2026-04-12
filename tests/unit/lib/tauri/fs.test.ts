import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

import { isMarkdownFile, scanFolder } from "../../../../src/lib/tauri/fs";

describe("isMarkdownFile", () => {
  it("accepts .md paths and rejects other extensions", () => {
    expect(isMarkdownFile("notes/today.md")).toBe(true);
    expect(isMarkdownFile("notes/today.txt")).toBe(false);
  });

  it("accepts uppercase .MD extensions", () => {
    expect(isMarkdownFile("notes/README.MD")).toBe(true);
  });
});

describe("scanFolder", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("maps scan results from tauri snake_case to frontend camelCase", async () => {
    invoke.mockResolvedValue([
      {
        path: "/workspace/notes/today.md",
        relative_path: "notes/today.md",
        name: "today.md",
        directory_label: "notes",
        excerpt: "Today notes",
        modified_at: 1710000000000,
      },
    ]);

    await expect(scanFolder("/workspace")).resolves.toEqual([
      {
        path: "/workspace/notes/today.md",
        relativePath: "notes/today.md",
        name: "today.md",
        directoryLabel: "notes",
        excerpt: "Today notes",
        modifiedAt: 1710000000000,
      },
    ]);
    expect(invoke).toHaveBeenCalledWith("scan_folder", { path: "/workspace" });
  });

  it("normalizes empty directory labels to root marker", async () => {
    invoke.mockResolvedValue([
      {
        path: "/workspace/index.md",
        relative_path: "index.md",
        name: "index.md",
        directory_label: "",
        excerpt: null,
        modified_at: null,
      },
    ]);

    await expect(scanFolder("/workspace")).resolves.toEqual([
      {
        path: "/workspace/index.md",
        relativePath: "index.md",
        name: "index.md",
        directoryLabel: ".",
        excerpt: null,
        modifiedAt: null,
      },
    ]);
  });
});
