import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "../../src/app/AppShell";
import type { PendingNavigation } from "../../src/types/editor";

function DirtyNavigationHarness() {
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>(null);
  const [isDirtyDocument, setIsDirtyDocument] = useState(true);
  const onOpenFile = vi.fn();
  const onCancelNavigation = vi.fn(() => setPendingNavigation(null));

  return (
    <>
      <AppShell
        workspacePath="E:/notes"
        hasActiveDocument
        isDirtyDocument={isDirtyDocument}
        pendingNavigation={pendingNavigation}
        onNewFile={vi.fn()}
        onOpenFile={onOpenFile}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onPendingNavigationChange={setPendingNavigation}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={onCancelNavigation}
      />
      <div data-testid="dirty-state">{isDirtyDocument ? "dirty" : "clean"}</div>
    </>
  );
}

describe("AppShell", () => {
  it("renders the welcome state when no workspace or document is loaded", () => {
    render(
      <AppShell
        workspacePath={null}
        hasActiveDocument={false}
        isDirtyDocument={false}
        pendingNavigation={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Markdown Editor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open File" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New" })).not.toBeInTheDocument();
  });

  it("renders the toolbar and workspace shell when a workspace is loaded", () => {
    render(
      <AppShell
        workspacePath="E:/notes"
        hasActiveDocument={false}
        isDirtyDocument={false}
        pendingNavigation={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open File" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save As" })).toBeInTheDocument();
    expect(screen.getByText("Workspace loaded: E:/notes")).toBeInTheDocument();
  });

  it("enables save when an active document exists", () => {
    render(
      <AppShell
        workspacePath="E:/notes"
        hasActiveDocument={true}
        isDirtyDocument={false}
        pendingNavigation={null}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onPendingNavigationChange={vi.fn()}
        onSaveAndContinue={vi.fn()}
        onDiscardChanges={vi.fn()}
        onCancelNavigation={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("blocks navigation-replacing actions when the active document is dirty", async () => {
    render(<DirtyNavigationHarness />);

    screen.getByRole("button", { name: "Open File" }).click();

    expect(await screen.findByRole("dialog", { name: "Unsaved changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    screen.getByRole("button", { name: "Cancel" }).click();

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Unsaved changes" })).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("dirty-state")).toHaveTextContent("dirty");
  });
});
