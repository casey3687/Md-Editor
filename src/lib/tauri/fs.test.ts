import { describe, expect, it } from "vitest";

import { isMarkdownFile } from "./fs";

describe("isMarkdownFile", () => {
  it("accepts .md paths and rejects other extensions", () => {
    expect(isMarkdownFile("notes/today.md")).toBe(true);
    expect(isMarkdownFile("notes/today.txt")).toBe(false);
  });

  it("accepts uppercase .MD extensions", () => {
    expect(isMarkdownFile("notes/README.MD")).toBe(true);
  });
});
