import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";

import styles from "./MarkdownEditor.module.css";

type MarkdownEditorProps = {
  content: string;
  onChange: (value: string) => void;
};

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  return (
    <div className={styles.editor}>
      <CodeMirror value={content} extensions={[markdown()]} onChange={(value) => onChange(value)} />
    </div>
  );
}
