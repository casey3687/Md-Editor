import { describe, expect, it } from "vitest";

import { createEditorStore } from "../../../src/store/editorStore";
import type { PendingNavigation } from "../../../src/types/editor";

describe("editor store", () => {
  it("defaults sidebar tab to files", () => {
    const store = createEditorStore();

    expect(store.getState().sidebarTab).toBe("files");
  });

  it("stores active documents with preview-edit mode and outline", () => {
    const store = createEditorStore();
    const document = {
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "hello",
      isDirty: false,
      mode: "preview-edit" as const,
      outline: [
        {
          id: "h1",
          text: "Title",
          level: 1,
          line: 1,
          anchor: "title",
          isActive: false,
        },
      ],
    };

    store.getState().setActiveDocument(document);

    expect(store.getState().activeDocument).toEqual(document);
  });

  it("copies the active document so later input mutation does not leak into state", () => {
    const store = createEditorStore();
    const document = {
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "hello",
      isDirty: false,
      mode: "preview-edit" as const,
      outline: [
        {
          id: "h1",
          text: "Title",
          level: 1,
          line: 1,
          anchor: "title",
          isActive: false,
        },
      ],
    };

    store.getState().setActiveDocument(document);
    document.content = "mutated";
    document.isDirty = true;
    document.outline[0].text = "Mutated";

    expect(store.getState().activeDocument).toEqual({
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "hello",
      isDirty: false,
      mode: "preview-edit",
      outline: [
        {
          id: "h1",
          text: "Title",
          level: 1,
          line: 1,
          anchor: "title",
          isActive: false,
        },
      ],
    });
  });

  it("toggles editor mode between preview-edit and source without changing content", () => {
    const store = createEditorStore();
    const document = {
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "hello",
      isDirty: false,
      mode: "preview-edit" as const,
      outline: [],
    };

    store.getState().setActiveDocument(document);
    store.getState().toggleEditorMode();

    expect(store.getState().activeDocument).toEqual({
      ...document,
      mode: "source",
    });

    store.getState().toggleEditorMode();

    expect(store.getState().activeDocument).toEqual(document);
  });

  it("marks the active document dirty when content changes", () => {
    const store = createEditorStore();
    store.getState().setActiveDocument({
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "hello",
      isDirty: false,
      mode: "preview-edit",
      outline: [],
    });

    store.getState().updateContent("hello world");

    expect(store.getState().activeDocument).toEqual({
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "hello world",
      isDirty: true,
      mode: "preview-edit",
      outline: [],
    });
  });

  it("keeps the active document unchanged when update content receives same string", () => {
    const store = createEditorStore();
    const document = {
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "hello",
      isDirty: false,
      mode: "preview-edit" as const,
      outline: [],
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

  it("stores active outline selection by id", () => {
    const store = createEditorStore();
    store.getState().setActiveDocument({
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "# Title\n\n## Section",
      isDirty: false,
      mode: "preview-edit",
      outline: [
        {
          id: "h1",
          text: "Title",
          level: 1,
          line: 1,
          anchor: "title",
          isActive: false,
        },
        {
          id: "h2",
          text: "Section",
          level: 2,
          line: 3,
          anchor: "section",
          isActive: false,
        },
      ],
    });

    store.getState().setActiveOutline("h2");

    expect(store.getState().activeDocument?.outline).toEqual([
      {
        id: "h1",
        text: "Title",
        level: 1,
        line: 1,
        anchor: "title",
        isActive: false,
      },
      {
        id: "h2",
        text: "Section",
        level: 2,
        line: 3,
        anchor: "section",
        isActive: true,
      },
    ]);
  });

  it("preserves the active outline item when the outline refreshes with a new id", () => {
    const store = createEditorStore();
    store.getState().setActiveDocument({
      path: "/workspace/notes/today.md",
      name: "today.md",
      content: "# Title\n\n## Section",
      isDirty: false,
      mode: "preview-edit",
      outline: [
        {
          id: "h1",
          text: "Title",
          level: 1,
          line: 1,
          anchor: "title",
          isActive: false,
        },
        {
          id: "h2",
          text: "Section",
          level: 2,
          line: 3,
          anchor: "section",
          isActive: false,
        },
      ],
    });

    store.getState().setActiveOutline("h2");
    store.getState().setOutline([
      {
        id: "section-5",
        text: "Section",
        level: 2,
        line: 5,
        anchor: "section",
        isActive: false,
      },
    ]);

    expect(store.getState().activeDocument?.outline).toEqual([
      {
        id: "section-5",
        text: "Section",
        level: 2,
        line: 5,
        anchor: "section",
        isActive: true,
      },
    ]);
  });
});
