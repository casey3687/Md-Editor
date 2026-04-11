import { FileTreeNodeView, type FileTreeNode } from "./FileTreeNode";

type FileTreeProps = {
  nodes: FileTreeNode[];
  activePath: string | null;
  onSelectFile: (path: string) => void;
};

export function FileTree({ nodes, activePath, onSelectFile }: FileTreeProps) {
  return (
    <nav aria-label="File tree">
      <ul>
        {nodes.map((node) => (
          <FileTreeNodeView key={node.path} node={node} activePath={activePath} onSelectFile={onSelectFile} />
        ))}
      </ul>
    </nav>
  );
}
