import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WelcomeView } from "../../src/app/WelcomeView";

describe("WelcomeView", () => {
  it("renders open folder and open file actions", () => {
    render(<WelcomeView onOpenFolder={() => {}} onOpenFile={() => {}} />);

    expect(screen.getByRole("button", { name: "Open Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open File" })).toBeInTheDocument();
  });

  it("calls the folder and file handlers when clicked", () => {
    const onOpenFolder = vi.fn();
    const onOpenFile = vi.fn();

    render(<WelcomeView onOpenFolder={onOpenFolder} onOpenFile={onOpenFile} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Open File" }));

    expect(onOpenFolder).toHaveBeenCalledTimes(1);
    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });
});