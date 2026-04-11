import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownPreview } from "../../src/features/preview/MarkdownPreview";

describe("MarkdownPreview", () => {
  it("renders GitHub-flavored markdown tables", () => {
    render(
      <MarkdownPreview
        content={`| Name | Value |
| --- | --- |
| One | 1 |`}
      />,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
