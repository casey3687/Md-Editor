import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkDeflist from "remark-deflist";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkSupersub from "remark-supersub";
import type { PluggableList } from "unified";

export const markdownRemarkPlugins: PluggableList = [
  [remarkGfm, { singleTilde: false }],
  remarkDeflist,
  remarkSupersub,
  remarkMath,
  remarkBreaks,
];
const sanitizeSchema = {
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
};

export const markdownRehypePlugins: PluggableList = [rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex];

export const markdownPlugins = markdownRemarkPlugins;

function normalizeWindowsImagePaths(markdown: string): string {
  return markdown.replace(
    /!\[([^\]]*)\]\(([A-Za-z]:[\\/][^)]+)\)/g,
    (_match, altText: string, windowsPath: string) => {
      const normalizedPath = windowsPath.replace(/\\/g, "/").replace(/\/+/g, "/");
      const encodedPath = encodeURI(normalizedPath);
      return `![${altText}](file:///${encodedPath})`;
    },
  );
}

export function normalizeMarkdownForPreview(markdown: string): string {
  const withNormalizedImages = normalizeWindowsImagePaths(markdown);
  const withoutCommentLines = withNormalizedImages.replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\r?\n?/gm, "");
  const normalizedBrBreaks = withoutCommentLines.replace(/<br\s*\/?>\r?\n/gi, "<br>");
  return normalizedBrBreaks.replace(/\n{3,}/g, "\n\n");
}
