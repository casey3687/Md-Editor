import { describe, expect, it } from "vitest";

import { collectPreviewBlocks, rewritePreviewBlock } from "../../../../src/lib/markdown/previewEdit";

describe("previewEdit helpers", () => {
  it("collects editable blocks and uses raw mode for complex markdown blocks", () => {
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
      { kind: "paragraph", editable: true, text: "First paragraph.", line: 3, level: undefined },
      { kind: "raw", editable: true, text: "```ts\nconst count = 1;\n```", line: 5, level: undefined },
      { kind: "heading", editable: true, text: "Next", line: 9, level: 2 },
    ]);
  });

  it("maps inline-marked paragraphs to raw editable blocks", () => {
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
        kind: "raw",
        text: "Paragraph with [link](https://example.com).",
        editable: true,
      }),
    ]);
    expect(result.hasUnsafeBlocks).toBe(false);
  });

  it("rewrites editable block text in the full markdown string", () => {
    const markdown = `# Title

First paragraph.

\`\`\`
const count = 1;
\`\`\``;

    const result = collectPreviewBlocks(markdown);
    const headingBlock = result.blocks.find((block) => block.kind === "heading");
    const paragraphBlock = result.blocks.find((block) => block.kind === "paragraph");
    const rawBlock = result.blocks.find((block) => block.kind === "raw");

    expect(headingBlock).toBeDefined();
    expect(paragraphBlock).toBeDefined();
    expect(rawBlock).toBeDefined();

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

    const rawRewrite = rewritePreviewBlock(paragraphRewrite.markdown, rawBlock!, "```ts\nconst count = 2;\n```");
    expect(rawRewrite.ok).toBe(true);
    expect(rawRewrite.markdown).toContain("const count = 2;");
  });
});
