import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FileTree } from "../../src/features/file-tree/FileTree";
import type { FileTreeNode } from "../../src/features/file-tree/FileTreeNode";

describe("FileTree", () => {
  it("renders file nodes and calls onSelectFile for file clicks", () => {
    const nodes: FileTreeNode[] = [
      {
        name: "notes",
        path: "/workspace/notes",
        kind: "folder",
        children: [
          {
            name: "todo.md",
            path: "/workspace/notes/todo.md",
            kind: "file",
          },
        ],
      },
    ];
    const onSelectFile = vi.fn();

    render(<FileTree nodes={nodes} activePath={null} onSelectFile={onSelectFile} />);

    screen.getByRole("button", { name: "todo.md" }).click();

    expect(onSelectFile).toHaveBeenCalledTimes(1);
    expect(onSelectFile).toHaveBeenCalledWith("/workspace/notes/todo.md");
  });
});
