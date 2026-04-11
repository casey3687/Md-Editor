import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "../../src/components/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("calls the matching handler for each action", () => {
    const onSaveAndContinue = vi.fn();
    const onDiscardChanges = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        pendingNavigation={null}
        onSaveAndContinue={onSaveAndContinue}
        onDiscardChanges={onDiscardChanges}
        onCancel={onCancel}
      />,
    );

    screen.getByRole("button", { name: "Save and continue" }).click();
    screen.getByRole("button", { name: "Discard changes" }).click();
    screen.getByRole("button", { name: "Cancel" }).click();

    expect(onSaveAndContinue).toHaveBeenCalledTimes(1);
    expect(onDiscardChanges).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
