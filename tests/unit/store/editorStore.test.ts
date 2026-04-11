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
    expect(store.getState().activeDocument).toBe(document);
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
});
