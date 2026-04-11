import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WelcomeView } from "../../src/app/WelcomeView";

describe("WelcomeView", () => {
  it("calls the matching handler for each welcome action", () => {
    const onOpenFolder = vi.fn();
    const onOpenFile = vi.fn();

    render(<WelcomeView onOpenFolder={onOpenFolder} onOpenFile={onOpenFile} />);

    screen.getByRole("button", { name: "Open Folder" }).click();
    screen.getByRole("button", { name: "Open File" }).click();

    expect(onOpenFolder).toHaveBeenCalledTimes(1);
    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });
});
