import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "../../src/components/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders the pending navigation message and calls the matching handler for each action", () => {
    const onSaveAndContinue = vi.fn();
    const onDiscardChanges = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        pendingNavigation={{ type: "open-file", path: "/workspace/notes/today.md" }}
        onSaveAndContinue={onSaveAndContinue}
        onDiscardChanges={onDiscardChanges}
        onCancel={onCancel}
      />,
    );

    expect(
      screen.getByText("You have unsaved changes. Do you want to save before you open file?"),
    ).toBeInTheDocument();

    screen.getByRole("button", { name: "Save and continue" }).click();
    screen.getByRole("button", { name: "Discard changes" }).click();
    screen.getByRole("button", { name: "Cancel" }).click();

    expect(onSaveAndContinue).toHaveBeenCalledTimes(1);
    expect(onDiscardChanges).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
