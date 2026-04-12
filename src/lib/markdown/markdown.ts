import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkDeflist from "remark-deflist";
import remarkGfm from "remark-gfm";
import remarkSupersub from "remark-supersub";
import type { PluggableList } from "unified";

export const markdownRemarkPlugins: PluggableList = [
  [remarkGfm, { singleTilde: false }],
  remarkDeflist,
  remarkSupersub,
];
export const markdownRehypePlugins: PluggableList = [rehypeRaw, rehypeSanitize];

export const markdownPlugins = markdownRemarkPlugins;
