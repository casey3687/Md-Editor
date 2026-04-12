import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { PreviewEditableSurface } from "../../src/features/preview/PreviewEditableSurface";

describe("PreviewEditableSurface", () => {
  it("edits plain heading and paragraph blocks through the shared markdown string", () => {
    const onContentChange = vi.fn();

    function Harness() {
      const [content, setContent] = useState(`# Title

Plain paragraph.

\`\`\`ts
const value = 1;
\`\`\``);

      return <PreviewEditableSurface content={content} onContentChange={(nextContent) => {
        onContentChange(nextContent);
        setContent(nextContent);
      }} />;
    }

    render(<Harness />);

    const headingEditor = screen.getByRole("textbox", { name: /Heading level 1/i });
    const paragraphEditor = screen.getByRole("textbox", { name: /Paragraph at line 3/i });

    headingEditor.textContent = "Updated title";
    fireEvent.blur(headingEditor);

    expect(onContentChange).toHaveBeenCalledWith(expect.stringContaining("# Updated title"));

    paragraphEditor.textContent = "Updated paragraph.";
    fireEvent.blur(paragraphEditor);

    expect(onContentChange).toHaveBeenLastCalledWith(expect.stringContaining("Updated paragraph."));
    expect(screen.getByRole("heading", { name: "Updated title" })).toBeInTheDocument();
    expect(screen.getByText("Updated paragraph.")).toBeInTheDocument();
    expect(screen.getByText("const value = 1;")).toBeInTheDocument();
  });

  it("keeps inline-marked paragraphs and other unsupported blocks read-only", () => {
    render(
      <PreviewEditableSurface
        content={`Paragraph with [link](https://example.com).

- item one
- item two`}
        onContentChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Some content can only be edited safely in source mode.");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "link" })).toBeInTheDocument();
    expect(screen.getByText("item one")).toBeInTheDocument();
    expect(screen.getByText("item two")).toBeInTheDocument();
  });
});
