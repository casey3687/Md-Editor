import ReactMarkdown from "react-markdown";

import { markdownRehypePlugins, markdownRemarkPlugins } from "../../lib/markdown/markdown";
import styles from "./MarkdownPreview.module.css";

type MarkdownPreviewProps = {
  content: string;
};

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className={styles.preview}>
      <ReactMarkdown
        className={styles.markdown}
        remarkPlugins={markdownRemarkPlugins}
        rehypePlugins={markdownRehypePlugins}
        components={{
          pre: ({ node: _node, ...props }) => <pre data-code-block="true" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
