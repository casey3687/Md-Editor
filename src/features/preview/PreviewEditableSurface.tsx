import { useEffect, useMemo, useState } from "react";

import { MarkdownPreview } from "./MarkdownPreview";
import {
  collectPreviewBlocks,
  rewritePreviewBlock,
  type PreviewBlock,
  type PreviewRewriteResult,
} from "../../lib/markdown/previewEdit";
import styles from "./PreviewEditableSurface.module.css";

type PreviewEditableSurfaceProps = {
  content: string;
  onContentChange: (content: string) => void;
};

type EditableBlockProps = {
  markdown: string;
  block: PreviewBlock;
  onCommit: (result: PreviewRewriteResult) => void;
};

function EditableBlock({ markdown, block, onCommit }: EditableBlockProps) {
  const ariaLabel =
    block.kind === "heading"
      ? `Heading level ${block.level ?? 1} at line ${block.line}`
      : `Paragraph at line ${block.line}`;

  const handleCommit = (text: string) => {
    onCommit(rewritePreviewBlock(markdown, block, text));
  };

  const editableText = (
    <span
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel}
      className={styles.editableText}
      onBlur={(event) => handleCommit(event.currentTarget.textContent ?? "")}
      onKeyDown={(event) => {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        event.currentTarget.blur();
      }}
    >
      {block.text}
    </span>
  );

  if (block.kind === "heading") {
    switch (block.level ?? 1) {
      case 1:
        return <h1 className={styles.editableHeading}>{editableText}</h1>;
      case 2:
        return <h2 className={styles.editableHeading}>{editableText}</h2>;
      case 3:
        return <h3 className={styles.editableHeading}>{editableText}</h3>;
      case 4:
        return <h4 className={styles.editableHeading}>{editableText}</h4>;
      case 5:
        return <h5 className={styles.editableHeading}>{editableText}</h5>;
      default:
        return <h6 className={styles.editableHeading}>{editableText}</h6>;
    }
  }

  return <p className={styles.editableParagraph}>{editableText}</p>;
}

function ReadOnlyBlock({ block }: { block: PreviewBlock }) {
  return (
    <div className={styles.readOnlyBlock} data-block-kind={block.kind}>
      <MarkdownPreview content={block.source} />
    </div>
  );
}

export function PreviewEditableSurface({ content, onContentChange }: PreviewEditableSurfaceProps) {
  const result = useMemo(() => collectPreviewBlocks(content), [content]);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const previewWarning =
    mappingError ?? (result.hasUnsafeBlocks ? "Some content can only be edited safely in source mode." : null);

  useEffect(() => {
    setMappingError(null);
  }, [content]);

  if (result.blocks.length === 0) {
    return (
      <div className={styles.surface} data-has-editable-blocks="false">
        {previewWarning ? (
          <p role="status" className={styles.warningMessage}>
            {previewWarning}
          </p>
        ) : null}
        <p className={styles.emptyParagraph}>
          <span
            key="empty-document"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Document body at line 1"
            className={styles.editableText}
            data-placeholder="Start writing..."
            onBlur={(event) => onContentChange(event.currentTarget.textContent ?? "")}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              event.currentTarget.blur();
            }}
          >
            {""}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.surface} data-has-editable-blocks={result.blocks.some((block) => block.editable)}>
      {previewWarning ? (
        <p role="status" className={styles.warningMessage}>
          {previewWarning}
        </p>
      ) : null}
      {result.blocks.map((block) =>
        block.editable ? (
          <EditableBlock
            key={`${block.id}-${block.text}`}
            markdown={content}
            block={block}
            onCommit={(commitResult) => {
              if (!commitResult.ok) {
                setMappingError("Preview edit could not be applied safely. Switch to source mode.");
                return;
              }

              setMappingError(null);
              onContentChange(commitResult.markdown);
            }}
          />
        ) : (
          <ReadOnlyBlock key={block.id} block={block} />
        ),
      )}
    </div>
  );
}
