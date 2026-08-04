import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Toolbar } from "../../src/features/toolbar/Toolbar";

describe("Toolbar", () => {
  it("calls each action handler and disables save when requested", () => {
    const onNewFile = vi.fn();
    const onOpenFile = vi.fn();
    const onOpenFolder = vi.fn();
    const onSave = vi.fn();
    const onSaveAs = vi.fn();

    render(
      <Toolbar
        disableSave
        onNewFile={onNewFile}
        onOpenFile={onOpenFile}
        onOpenFolder={onOpenFolder}
        onSave={onSave}
        onSaveAs={onSaveAs}
      />,
    );

    screen.getByRole("button", { name: "New" }).click();
    screen.getByRole("button", { name: "Open File" }).click();
    screen.getByRole("button", { name: "Open Folder" }).click();
    screen.getByRole("button", { name: "Save As" }).click();

    expect(onNewFile).toHaveBeenCalledTimes(1);
    expect(onOpenFile).toHaveBeenCalledTimes(1);
    expect(onOpenFolder).toHaveBeenCalledTimes(1);
    expect(onSaveAs).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows the current appearance mode on the appearance button", () => {
    render(
      <Toolbar
        disableSave={false}
        appearanceMode="dark"
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onToggleAppearance={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "夜间模式" })).toBeInTheDocument();
  });
  it("opens settings from the toolbar", () => {
    const onOpenSettings = vi.fn();

    render(
      <Toolbar
        disableSave={false}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onOpenSettings={onOpenSettings}
      />,
    );

    screen.getByRole("button", { name: "Settings" }).click();

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
