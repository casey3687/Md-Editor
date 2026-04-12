import { describe, expect, it } from "vitest";

import { createEditorStore } from "../../src/store/editorStore";

describe("UnsavedChangesFlow", () => {
  it("keeps the current document dirty after content changes", () => {
    const store = createEditorStore();

    store.getState().setActiveDocument({
      path: "docs/a.md",
      name: "a.md",
      content: "# First",
      isDirty: false,
      mode: "preview-edit",
      outline: [],
    });

    store.getState().updateContent("# First updated");

    expect(store.getState().activeDocument).toEqual({
      path: "docs/a.md",
      name: "a.md",
      content: "# First updated",
      isDirty: true,
      mode: "preview-edit",
      outline: [],
    });
  });

  it("clears pending navigation without changing the active document", () => {
    const store = createEditorStore();

    store.getState().setActiveDocument({
      path: "docs/a.md",
      name: "a.md",
      content: "# First",
      isDirty: true,
      mode: "preview-edit",
      outline: [],
    });
    store.getState().setPendingNavigation({ type: "open-file", path: "docs/b.md" });
    const before = store.getState().activeDocument;

    store.getState().clearPendingNavigation();

    expect(store.getState().pendingNavigation).toBeNull();
    expect(store.getState().activeDocument).toEqual(before);
  });
});
