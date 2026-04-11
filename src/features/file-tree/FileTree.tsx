import { FileTreeNode } from "./FileTreeNode";
import type { DirectoryNode } from "../../types/editor";

type FileTreeProps = {
  nodes: DirectoryNode[];
  activePath: string | null;
  onSelectFile: (path: string) => void;
};

export function FileTree({ nodes, activePath, onSelectFile }: FileTreeProps) {
  return (
    <nav aria-label="File tree">
      <ul>
        {nodes.map((node) => (
          <FileTreeNode key={node.path} node={node} activePath={activePath} onSelectFile={onSelectFile} />
        ))}
      </ul>
    </nav>
  );
}
