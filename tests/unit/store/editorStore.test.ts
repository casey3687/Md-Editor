import { describe, expect, it } from "vitest";

import { createEditorStore } from "../../../src/store/editorStore";
import type { PendingNavigation } from "../../../src/types/editor";

describe("editor store", () => {
  it("marks the active document dirty when its content changes", () => {
    const store = createEditorStore();
    const document = {
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "hello",
      isDirty: false,
    };

    store.getState().setActiveDocument(document);
    store.getState().updateContent("hello world");

    expect(store.getState().activeDocument).toEqual({
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "hello world",
      isDirty: true,
    });
  });

  it("copies the active document so later input mutation does not leak into state", () => {
    const store = createEditorStore();
    const document = {
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "hello",
      isDirty: false,
    };

    store.getState().setActiveDocument(document);
    document.content = "mutated";
    document.isDirty = true;

    expect(store.getState().activeDocument).toEqual({
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "hello",
      isDirty: false,
    });
  });

  it("keeps the active document clean when the content is unchanged", () => {
    const store = createEditorStore();
    const document = {
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "hello",
      isDirty: false,
    };

    store.getState().setActiveDocument(document);
    const before = store.getState();

    store.getState().updateContent("hello");

    expect(store.getState()).toBe(before);
    expect(store.getState().activeDocument).toEqual(document);
  });

  it("does nothing when there is no active document", () => {
    const store = createEditorStore();
    const before = store.getState();

    store.getState().updateContent("hello world");

    expect(store.getState()).toBe(before);
    expect(store.getState().activeDocument).toBeNull();
  });

  it("stores pending navigation requests", () => {
    const store = createEditorStore();
    const pending = { type: "open-file", path: "/workspace/notes/today.md" } as const;

    store.getState().setPendingNavigation(pending);

    expect(store.getState().pendingNavigation).toEqual(pending);
  });

  it("copies pending navigation so later input mutation does not leak into state", () => {
    const store = createEditorStore();
    const pending: Extract<PendingNavigation, { type: "open-file" }> = {
      type: "open-file",
      path: "/workspace/notes/today.md",
    };

    store.getState().setPendingNavigation(pending);
    pending.path = "/workspace/notes/changed.md";

    expect(store.getState().pendingNavigation).toEqual({
      type: "open-file",
      path: "/workspace/notes/today.md",
    });
  });

  it("copies the workspace tree so later nested mutations do not leak into state", () => {
    const store = createEditorStore();
    const tree = [
      {
        path: "/workspace/notes",
        name: "notes",
        kind: "directory" as const,
        children: [
          {
            path: "/workspace/notes/today.md",
            name: "today.md",
            kind: "file" as const,
          },
        ],
      },
    ];

    store.getState().setWorkspace("/workspace", tree);
    tree[0].name = "mutated";
    tree[0].children[0].name = "mutated.md";

    expect(store.getState().tree).toEqual([
      {
        path: "/workspace/notes",
        name: "notes",
        kind: "directory",
        children: [
          {
            path: "/workspace/notes/today.md",
            name: "today.md",
            kind: "file",
          },
        ],
      },
    ]);
  });
});
