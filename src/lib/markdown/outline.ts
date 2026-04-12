import { unified } from "unified";
import remarkParse from "remark-parse";

import type { OutlineItem } from "../../types/editor";

type Position = {
  start?: {
    line?: number;
  };
};

type MarkdownNode = {
  type: string;
  value?: string;
  alt?: string;
  depth?: number;
  position?: Position;
  children?: MarkdownNode[];
};

function extractNodeText(node: MarkdownNode): string {
  if (typeof node.value === "string") {
    return node.value;
  }

  if (typeof node.alt === "string") {
    return node.alt;
  }

  if (!node.children) {
    return "";
  }

  return node.children.map(extractNodeText).join("");
}

function slugifyHeading(text: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return base.length > 0 ? base : "section";
}

function collectHeadingNodes(node: MarkdownNode, headings: MarkdownNode[]): void {
  if (node.type === "heading") {
    headings.push(node);
  }

  if (!node.children) {
    return;
  }

  for (const child of node.children) {
    collectHeadingNodes(child, headings);
  }
}

export function extractMarkdownOutline(markdown: string): OutlineItem[] {
  const root = unified().use(remarkParse).parse(markdown) as MarkdownNode;
  const headingNodes: MarkdownNode[] = [];
  const slugCounters = new Map<string, number>();

  collectHeadingNodes(root, headingNodes);

  return headingNodes.map((node) => {
    const text = extractNodeText(node).trim();
    const line = node.position?.start?.line ?? 1;
    const level = node.depth ?? 1;
    const baseSlug = slugifyHeading(text);
    const count = (slugCounters.get(baseSlug) ?? 0) + 1;
    slugCounters.set(baseSlug, count);
    const anchor = count === 1 ? baseSlug : `${baseSlug}-${count}`;

    return {
      id: `${anchor}-${line}`,
      text: text.length > 0 ? text : "Untitled section",
      level,
      line,
      anchor,
      isActive: false,
    };
  });
}
