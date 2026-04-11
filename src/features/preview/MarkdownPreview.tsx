import ReactMarkdown from "react-markdown";

import { markdownPlugins } from "../../lib/markdown/markdown";

type MarkdownPreviewProps = {
  content: string;
};

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return <ReactMarkdown remarkPlugins={markdownPlugins}>{content}</ReactMarkdown>;
}
