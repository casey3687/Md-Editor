import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = resolve(__dirname, "../../..");

function readProjectFile(path: string) {
  return readFileSync(resolve(rootDir, path), "utf8");
}

describe("dark theme tokens", () => {
  it("uses a light editor-style code block palette in day mode", () => {
    const globalCss = readProjectFile("src/styles/global.css");

    expect(globalCss).toContain("--inline-code-bg: #f1f5f9;");
    expect(globalCss).toContain("--inline-code-text: #7c3aed;");
    expect(globalCss).toContain("--code-block-bg: #f8fafc;");
    expect(globalCss).toContain("--code-block-text: #0f172a;");
    expect(globalCss).toContain("--code-header-bg: #f1f5f9;");
    expect(globalCss).toContain("--code-header-text: #64748b;");
    expect(globalCss).toContain("--copy-button-bg: #ffffff;");
    expect(globalCss).toContain("--copy-button-text: #64748b;");
  });

  it("uses neutral Typora-like dark surfaces instead of saturated blue panels", () => {
    const globalCss = readProjectFile("src/styles/global.css");

    expect(globalCss).toContain("--app-bg: #0d1117;");
    expect(globalCss).toContain("--surface-strong: #161b22;");
    expect(globalCss).toContain("--sidebar-bg: #0d1117;");
    expect(globalCss).toContain("--inline-code-bg: rgba(110, 118, 129, 0.22);");
  });

  it("shares preview-specific dark colors across both preview surfaces", () => {
    const globalCss = readProjectFile("src/styles/global.css");
    const markdownPreviewCss = readProjectFile("src/features/preview/MarkdownPreview.module.css");
    const editablePreviewCss = readProjectFile("src/features/preview/PreviewEditableSurface.module.css");

    expect(globalCss).toContain("--preview-quote-border:");
    expect(globalCss).toContain("--preview-table-header-bg:");
    expect(markdownPreviewCss).toContain("var(--preview-quote-border)");
    expect(markdownPreviewCss).toContain("var(--preview-table-header-bg)");
    expect(editablePreviewCss).toContain("var(--preview-quote-border)");
    expect(editablePreviewCss).toContain("var(--preview-table-header-bg)");
  });

  it("does not add a blue focus border to the editable preview surface", () => {
    const editablePreviewCss = readProjectFile("src/features/preview/PreviewEditableSurface.module.css");

    expect(editablePreviewCss).not.toContain(".surface:focus");
    expect(editablePreviewCss).not.toContain("rgba(29, 78, 216, 0.32)");
    expect(editablePreviewCss).not.toContain("rgba(29, 78, 216, 0.18)");
  });
});
