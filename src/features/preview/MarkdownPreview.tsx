import { isValidElement, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";

import {
  markdownRehypePlugins,
  markdownRemarkPlugins,
  normalizeMarkdownForPreview,
} from "../../lib/markdown/markdown";
import styles from "./MarkdownPreview.module.css";

type MarkdownPreviewProps = {
  content: string;
};

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const normalizedContent = normalizeMarkdownForPreview(content);

  const extractLanguage = (children: React.ReactNode) => {
    if (!isValidElement(children)) {
      return null;
    }

    const codeElement = children as ReactElement<{ className?: string }>;
    const className = codeElement.props.className ?? "";
    const matched = className.match(/language-([a-z0-9_-]+)/i);
    return matched?.[1]?.toLowerCase() ?? null;
  };

  return (
    <div className={styles.preview}>
      <ReactMarkdown
        className={styles.markdown}
        remarkPlugins={markdownRemarkPlugins}
        rehypePlugins={markdownRehypePlugins}
        components={{
          a: ({ node: _node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
          pre: ({ node: _node, children, ...props }) => {
            const language = extractLanguage(children);

            return (
              <div className={styles.codeBlock}>
                {language ? <div className={styles.codeLanguage}>{language}</div> : null}
                <pre data-code-block="true" {...props}>
                  {children}
                </pre>
              </div>
            );
          },
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
