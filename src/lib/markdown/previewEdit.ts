import { unified } from "unified";
import remarkParse from "remark-parse";

type Position = {
  start?: {
    line?: number;
    offset?: number;
  };
  end?: {
    line?: number;
    offset?: number;
  };
};

type MarkdownNode = {
  type: string;
  value?: string;
  depth?: number;
  position?: Position;
  children?: MarkdownNode[];
};

export type PreviewBlockKind = "heading" | "paragraph" | "raw";

export type PreviewBlock = {
  id: string;
  kind: PreviewBlockKind;
  text: string;
  editable: boolean;
  level?: number;
  source: string;
  line: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
};

export type PreviewBlocksResult = {
  blocks: PreviewBlock[];
  hasUnsafeBlocks: boolean;
};

export type PreviewRewriteResult = {
  ok: boolean;
  markdown: string;
  reason?: "read-only" | "missing-block" | "stale-block";
};

const HEADING_PATTERN = /^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$/;
const ATX_HEADING_REWRITE_PATTERN = /^(#{1,6})([ \t]+)(.*?)([ \t]+#+[ \t]*)?$/;

function extractNodeText(node: MarkdownNode): string {
  if (typeof node.value === "string") {
    return node.value;
  }

  if (!node.children) {
    return "";
  }

  return node.children.map(extractNodeText).join("");
}

function hasOnlyTextChildren(node: MarkdownNode): boolean {
  return node.children?.every((child) => child.type === "text") ?? false;
}

function isCommentHtml(sourceSlice: string): boolean {
  return /^\s*<!--[\s\S]*?-->\s*$/.test(sourceSlice);
}

function asMappedPosition(position: Position | undefined) {
  const line = position?.start?.line;
  const endLine = position?.end?.line;
  const startOffset = position?.start?.offset;
  const endOffset = position?.end?.offset;

  if (
    typeof line !== "number" ||
    typeof endLine !== "number" ||
    typeof startOffset !== "number" ||
    typeof endOffset !== "number"
  ) {
    return null;
  }

  return { line, endLine, startOffset, endOffset };
}

function createBlockId(index: number, kind: PreviewBlockKind, line: number): string {
  return `block-${index + 1}-${kind}-${line}`;
}

function collectBlocks(markdown: string): PreviewBlocksResult {
  const root = unified().use(remarkParse).parse(markdown) as { children?: MarkdownNode[] };
  const blocks: PreviewBlock[] = [];
  let hasUnsafeBlocks = false;
  const children = root.children ?? [];

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    const mappedPosition = asMappedPosition(node.position);

    if (!mappedPosition) {
      hasUnsafeBlocks = true;
      continue;
    }

    const sourceSlice = markdown.slice(mappedPosition.startOffset, mappedPosition.endOffset);
    if (node.type === "html" && isCommentHtml(sourceSlice)) {
      continue;
    }

    const idFor = (kind: PreviewBlockKind) => createBlockId(index, kind, mappedPosition.line);

    if (node.type === "heading") {
      const headingMatch = sourceSlice.trim().match(HEADING_PATTERN);
      const editable = headingMatch !== null && !sourceSlice.includes("\n") && hasOnlyTextChildren(node);

      blocks.push({
        id: idFor("heading"),
        kind: "heading",
        text: extractNodeText(node).trim(),
        editable,
        level: node.depth,
        source: sourceSlice,
        ...mappedPosition,
      });

      if (!editable) {
        blocks.push({
          id: idFor("raw"),
          kind: "raw",
          text: sourceSlice,
          editable: true,
          source: sourceSlice,
          ...mappedPosition,
        });
      }
      continue;
    }

    if (node.type === "paragraph") {
      const editable = hasOnlyTextChildren(node);
      if (!editable) {
        blocks.push({
          id: idFor("raw"),
          kind: "raw",
          text: sourceSlice,
          editable: true,
          source: sourceSlice,
          ...mappedPosition,
        });
        continue;
      }

      blocks.push({
        id: idFor("paragraph"),
        kind: "paragraph",
        text: extractNodeText(node).trim(),
        editable: true,
        source: sourceSlice,
        ...mappedPosition,
      });
      continue;
    }

    blocks.push({
      id: idFor("raw"),
      kind: "raw",
      text: sourceSlice,
      editable: true,
      source: sourceSlice,
      ...mappedPosition,
    });
  }

  return { blocks, hasUnsafeBlocks };
}

export function collectPreviewBlocks(markdown: string): PreviewBlocksResult {
  return collectBlocks(markdown);
}

function rewriteHeading(sourceSlice: string, nextText: string): string | null {
  const match = sourceSlice.match(ATX_HEADING_REWRITE_PATTERN);

  if (!match) {
    return null;
  }

  const marker = match[1];
  const separator = match[2];
  const suffix = match[4] ?? "";
  return `${marker}${separator}${nextText}${suffix}`;
}

export function rewritePreviewBlock(
  markdown: string,
  targetBlock: PreviewBlock,
  nextText: string,
): PreviewRewriteResult {
  if (!targetBlock.editable) {
    return { ok: false, markdown, reason: "read-only" };
  }

  const refreshed = collectBlocks(markdown).blocks.find((block) => block.id === targetBlock.id);

  if (!refreshed) {
    return { ok: false, markdown, reason: "missing-block" };
  }

  if (!refreshed.editable) {
    return { ok: false, markdown, reason: "stale-block" };
  }

  const sourceSlice = markdown.slice(refreshed.startOffset, refreshed.endOffset);
  let replacement: string | null = null;

  if (refreshed.kind === "heading") {
    replacement = rewriteHeading(sourceSlice, nextText);
    if (replacement === null) {
      replacement = nextText;
    }
  } else if (refreshed.kind === "paragraph" || refreshed.kind === "raw") {
    replacement = nextText;
  } else {
    return { ok: false, markdown, reason: "read-only" };
  }

  return {
    ok: true,
    markdown:
      markdown.slice(0, refreshed.startOffset) + replacement + markdown.slice(refreshed.endOffset),
  };
}
