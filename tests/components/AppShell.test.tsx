import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "../../src/app/AppShell";

describe("AppShell", () => {
  it("requests pending navigation when a dirty action is blocked", () => {
    const onNewFile = vi.fn();
    const onPendingNavigationChange = vi.fn();

    render(
      <AppShell
        workspacePath="E:/notes"
        hasActiveDocument
        isDirtyDocument
        pendingNavigation={null}
        onNewFile={onNewFile}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onPendingNavigationChange={onPendingNavigationChange}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    screen.getByRole("button", { name: "New" }).click();

    expect(onNewFile).not.toHaveBeenCalled();
    expect(onPendingNavigationChange).toHaveBeenCalledTimes(1);
    expect(onPendingNavigationChange).toHaveBeenCalledWith({ type: "new-file" });
  });

  it.each([
    ["Save and continue", "onSaveAndContinue"],
    ["Discard changes", "onDiscardChanges"],
    ["Cancel", "onCancelNavigation"],
  ] as const)("calls %s without clearing pending navigation in the shell", (buttonName, callbackName) => {
    const pendingNavigation = { type: "open-file", path: "/workspace/notes/today.md" } as const;
    const onPendingNavigationChange = vi.fn();
    const callbacks = {
      onSaveAndContinue: vi.fn(),
      onDiscardChanges: vi.fn(),
      onCancelNavigation: vi.fn(),
    };

    render(
      <AppShell
        workspacePath="E:/notes"
        hasActiveDocument
        isDirtyDocument
        pendingNavigation={pendingNavigation}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onPendingNavigationChange={onPendingNavigationChange}
        onSaveAndContinue={callbacks.onSaveAndContinue}
        onDiscardChanges={callbacks.onDiscardChanges}
        onCancelNavigation={callbacks.onCancelNavigation}
      />,
    );

    screen.getByRole("button", { name: buttonName }).click();

    expect(callbacks[callbackName]).toHaveBeenCalledTimes(1);
    expect(onPendingNavigationChange).not.toHaveBeenCalled();
  });
});
