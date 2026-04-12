import { describe, expect, it } from "vitest";

import { extractMarkdownOutline } from "../../../../src/lib/markdown/outline";

describe("extractMarkdownOutline", () => {
  it("extracts heading outline items in source order with deterministic anchors", () => {
    const markdown = `# Intro

## Overview

# Intro

### API & Usage`;

    expect(extractMarkdownOutline(markdown)).toEqual([
      {
        id: "intro-1",
        text: "Intro",
        level: 1,
        line: 1,
        anchor: "intro",
        isActive: false,
      },
      {
        id: "overview-3",
        text: "Overview",
        level: 2,
        line: 3,
        anchor: "overview",
        isActive: false,
      },
      {
        id: "intro-2-5",
        text: "Intro",
        level: 1,
        line: 5,
        anchor: "intro-2",
        isActive: false,
      },
      {
        id: "api-usage-7",
        text: "API & Usage",
        level: 3,
        line: 7,
        anchor: "api-usage",
        isActive: false,
      },
    ]);
  });
});
