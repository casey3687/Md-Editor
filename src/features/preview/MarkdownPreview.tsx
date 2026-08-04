import { isValidElement, useEffect, useRef, useState, type ReactElement } from "react";
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
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const copyToastTimerRef = useRef<number | null>(null);

  const showCopySuccessToast = () => {
    if (copyToastTimerRef.current !== null) {
      window.clearTimeout(copyToastTimerRef.current);
    }

    setCopyToastVisible(true);
    copyToastTimerRef.current = window.setTimeout(() => {
      copyToastTimerRef.current = null;
      setCopyToastVisible(false);
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current !== null) {
        window.clearTimeout(copyToastTimerRef.current);
      }
    };
  }, []);

  const extractText = (children: React.ReactNode): string => {
    if (children === null || children === undefined || typeof children === "boolean") {
      return "";
    }

    if (typeof children === "string" || typeof children === "number") {
      return String(children);
    }

    if (Array.isArray(children)) {
      return children.map(extractText).join("");
    }

    if (isValidElement(children)) {
      return extractText((children as ReactElement<{ children?: React.ReactNode }>).props.children);
    }

    return "";
  };

  const extractLanguage = (children: React.ReactNode) => {
    if (!isValidElement(children)) {
      return null;
    }

    const codeElement = children as ReactElement<{ className?: string }>;
    const className = codeElement.props.className ?? "";
    const matched = className.match(/language-([a-z0-9_+#.-]+)/i);
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
          img: ({ node: _node, className, ...props }) => (
            <img
              className={[styles.responsiveImage, className].filter(Boolean).join(" ")}
              loading="lazy"
              {...props}
            />
          ),
          pre: ({ node: _node, children, ...props }) => {
            const language = extractLanguage(children);
            const codeText = extractText(children).replace(/\n$/, "");

            const copyCode = () => {
              if (!navigator.clipboard?.writeText) {
                return;
              }

              showCopySuccessToast();
              void navigator.clipboard.writeText(codeText).catch(() => undefined);
            };

            return (
              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>
                  {language ? <span className={styles.codeLanguage}>{language}</span> : <span />}
                  <button type="button" aria-label="Copy code block" onClick={copyCode} className={styles.copyCodeButton}>
                    复制
                  </button>
                </div>
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
      {copyToastVisible ? (
        <div role="status" className={styles.copyToast}>
          复制成功
        </div>
      ) : null}
    </div>
  );
}
