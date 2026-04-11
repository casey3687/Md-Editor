import { describe, expect, it } from "vitest";

import { createEditorStore } from "../../../src/store/editorStore";

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

  it("stores pending navigation requests", () => {
    const store = createEditorStore();
    const pending = { type: "open-file", path: "/workspace/notes/today.md" } as const;

    store.getState().setPendingNavigation(pending);

    expect(store.getState().pendingNavigation).toEqual(pending);
  });
});
