import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkBreaks from "remark-breaks";
import remarkDeflist from "remark-deflist";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkSupersub from "remark-supersub";
import TurndownService from "turndown";
import { gfm as turndownGfm } from "turndown-plugin-gfm";
import { unified } from "unified";

function normalizeMarkdownForWysiwyg(markdown: string): string {
  const normalizedWindowsImagePaths = markdown.replace(
    /!\[([^\]]*)\]\(([A-Za-z]:[\\/][^)]+)\)/g,
    (_match, altText: string, windowsPath: string) => {
      const normalizedPath = windowsPath.replace(/\\/g, "/").replace(/\/+/g, "/");
      const encodedPath = encodeURI(normalizedPath);
      return `![${altText}](file:///${encodedPath})`;
    },
  );
  const withoutCommentLines = normalizedWindowsImagePaths.replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\r?\n?/gm, "");
  const normalizedBrBreaks = withoutCommentLines.replace(/<br\s*\/?>\r?\n/gi, "<br>");
  return normalizedBrBreaks.replace(/\n{3,}/g, "\n\n");
}

const markdownToHtmlProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm, { singleTilde: false })
  .use(remarkDeflist)
  .use(remarkSupersub)
  .use(remarkMath)
  .use(remarkBreaks)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      a: [...(defaultSchema.attributes?.a ?? []), "href", "target", "rel"],
      img: [...(defaultSchema.attributes?.img ?? []), "src", "alt", "title", "width", "height"],
      code: [...(defaultSchema.attributes?.code ?? []), "className"],
      span: [...(defaultSchema.attributes?.span ?? []), "className"],
      div: [...(defaultSchema.attributes?.div ?? []), "className"],
      input: [...(defaultSchema.attributes?.input ?? []), "type", "checked", "disabled"],
    },
    protocols: {
      ...defaultSchema.protocols,
      href: [...(defaultSchema.protocols?.href ?? []), "file"],
      src: [...(defaultSchema.protocols?.src ?? []), "file", "data"],
    },
  })
  .use(rehypeKatex)
  .use(rehypeStringify);

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});
turndown.use(turndownGfm);
turndown.addRule("katexDisplay", {
  filter: (node) =>
    node instanceof HTMLElement &&
    node.classList.contains("katex-display"),
  replacement: (_content, node) => {
    const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
    const tex = annotation?.textContent?.trim();
    if (!tex) {
      return "\n\n";
    }
    return `\n\n$$\n${tex}\n$$\n\n`;
  },
});

turndown.addRule("katexInline", {
  filter: (node) =>
    node instanceof HTMLElement &&
    node.classList.contains("katex") &&
    !node.parentElement?.classList.contains("katex-display"),
  replacement: (_content, node) => {
    const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
    const tex = annotation?.textContent?.trim();
    return tex ? `$${tex}$` : "";
  },
});

export function markdownToWysiwygHtml(markdown: string): string {
  const normalized = normalizeMarkdownForWysiwyg(markdown);
  return String(markdownToHtmlProcessor.processSync(normalized));
}

export function wysiwygHtmlToMarkdown(html: string): string {
  const rawMarkdown = turndown.turndown(html);
  return rawMarkdown.replace(/\n{3,}/g, "\n\n");
}
