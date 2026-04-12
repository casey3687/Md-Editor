import { describe, expect, it } from "vitest";

import { collectPreviewBlocks, rewritePreviewBlock } from "../../../../src/lib/markdown/previewEdit";

describe("previewEdit helpers", () => {
  it("collects safe editable blocks for headings and paragraphs while keeping code fences read-only", () => {
    const markdown = `# Title

First paragraph.

\`\`\`ts
const count = 1;
\`\`\`

## Next`;

    const result = collectPreviewBlocks(markdown);
    const blockSummary = result.blocks.map((block) => ({
      kind: block.kind,
      editable: block.editable,
      text: block.text,
      line: block.line,
      level: block.level,
    }));

    expect(result.hasUnsafeBlocks).toBe(false);
    expect(blockSummary).toEqual([
      { kind: "heading", editable: true, text: "Title", line: 1, level: 1 },
      { kind: "paragraph", editable: true, text: "First paragraph.", line: 3 },
      { kind: "code", editable: false, text: "const count = 1;", line: 5 },
      { kind: "heading", editable: true, text: "Next", line: 9, level: 2 },
    ]);
  });

  it("marks paragraphs with inline markdown as read-only", () => {
    const markdown = `Plain text paragraph.

Paragraph with [link](https://example.com).`;

    const result = collectPreviewBlocks(markdown);

    expect(result.blocks).toEqual([
      expect.objectContaining({
        kind: "paragraph",
        text: "Plain text paragraph.",
        editable: true,
      }),
      expect.objectContaining({
        kind: "paragraph",
        text: "Paragraph with link.",
        editable: false,
      }),
    ]);
    expect(result.hasUnsafeBlocks).toBe(true);
  });

  it("rewrites editable block text in the full markdown string and rejects read-only blocks", () => {
    const markdown = `# Title

First paragraph.

\`\`\`
const count = 1;
\`\`\``;

    const result = collectPreviewBlocks(markdown);
    const headingBlock = result.blocks.find((block) => block.kind === "heading");
    const paragraphBlock = result.blocks.find((block) => block.kind === "paragraph");
    const codeBlock = result.blocks.find((block) => block.kind === "code");

    expect(headingBlock).toBeDefined();
    expect(paragraphBlock).toBeDefined();
    expect(codeBlock).toBeDefined();

    const headingRewrite = rewritePreviewBlock(markdown, headingBlock!, "Updated title");
    expect(headingRewrite.ok).toBe(true);
    expect(headingRewrite.markdown).toContain("# Updated title");

    const paragraphRewrite = rewritePreviewBlock(headingRewrite.markdown, paragraphBlock!, "Updated paragraph.");
    expect(paragraphRewrite.ok).toBe(true);
    expect(paragraphRewrite.markdown).toContain("Updated paragraph.");

    const whitespaceRewrite = rewritePreviewBlock(paragraphRewrite.markdown, paragraphBlock!, "Updated  paragraph.");
    expect(whitespaceRewrite.ok).toBe(true);
    expect(whitespaceRewrite.markdown).toContain("Updated  paragraph.");

    const emptyHeadingRewrite = rewritePreviewBlock(whitespaceRewrite.markdown, headingBlock!, "");
    expect(emptyHeadingRewrite.ok).toBe(true);
    expect(emptyHeadingRewrite.markdown).toContain("# ");

    const suffixMarkdown = `## Heading ##`;
    const suffixHeading = collectPreviewBlocks(suffixMarkdown).blocks.find((block) => block.kind === "heading");
    expect(suffixHeading).toBeDefined();

    const suffixRewrite = rewritePreviewBlock(suffixMarkdown, suffixHeading!, "Updated heading");
    expect(suffixRewrite.ok).toBe(true);
    expect(suffixRewrite.markdown).toBe("## Updated heading ##");

    const codeRewrite = rewritePreviewBlock(paragraphRewrite.markdown, codeBlock!, "const count = 2;");
    expect(codeRewrite.ok).toBe(false);
    expect(codeRewrite.markdown).toBe(paragraphRewrite.markdown);
  });
});
