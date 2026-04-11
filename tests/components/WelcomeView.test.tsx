import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WelcomeView } from "../../src/app/WelcomeView";

describe("WelcomeView", () => {
  it("renders open folder and open file actions", () => {
    render(<WelcomeView onOpenFolder={() => {}} onOpenFile={() => {}} />);

    expect(screen.getByRole("button", { name: "Open Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open File" })).toBeInTheDocument();
  });
});