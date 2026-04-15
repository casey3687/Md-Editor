import { describe, expect, it } from "vitest";

import { normalizeMarkdownForPreview } from "../../../../src/lib/markdown/markdown";

describe("normalizeMarkdownForPreview", () => {
  it("removes html comment-only lines", () => {
    const markdown = `> quote
<!-- hidden -->
---

## 标题`;

    expect(normalizeMarkdownForPreview(markdown)).toBe(`> quote
---

## 标题`);
  });

  it("keeps html break as single line break without inserting an extra blank line", () => {
    const markdown = "line1<br>\nline2";

    expect(normalizeMarkdownForPreview(markdown)).toBe("line1<br>line2");
  });

  it("normalizes windows absolute image paths to file protocol", () => {
    const markdown = "![img](C:\\\\notes\\\\pic 1.png)";

    expect(normalizeMarkdownForPreview(markdown)).toBe("![img](file:///C:/notes/pic%201.png)");
  });
});
