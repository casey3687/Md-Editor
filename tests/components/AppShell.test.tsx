import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "../../src/app/AppShell";

describe("AppShell", () => {
  it("renders the welcome state when no workspace or document is loaded", () => {
    render(
      <AppShell
        workspacePath={null}
        hasActiveDocument={false}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
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
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
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
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});
