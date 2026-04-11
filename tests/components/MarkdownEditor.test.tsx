import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownEditor } from "../../src/features/editor/MarkdownEditor";

describe("MarkdownEditor", () => {
  it("renders the initial content", () => {
    render(<MarkdownEditor content="# Hello" onChange={vi.fn()} />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
