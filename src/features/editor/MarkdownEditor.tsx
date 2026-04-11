import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";

type MarkdownEditorProps = {
  content: string;
  onChange: (value: string) => void;
};

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  return <CodeMirror value={content} extensions={[markdown()]} onChange={onChange} />;
}
