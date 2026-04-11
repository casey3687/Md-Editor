import type { DirectoryNode } from "../../types/editor";

type FileTreeNodeProps = {
  node: DirectoryNode;
  activePath: string | null;
  onSelectFile: (path: string) => void;
};

export function FileTreeNode({ node, activePath, onSelectFile }: FileTreeNodeProps) {
  const isActive = node.kind === "file" && node.path === activePath;

  if (node.kind === "file") {
    return (
      <li>
        <button type="button" aria-current={isActive ? "page" : undefined} onClick={() => onSelectFile(node.path)}>
          {node.name}
        </button>
      </li>
    );
  }

  return (
    <li>
      <div>{node.name}</div>
      {node.children?.length ? (
        <ul>
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} activePath={activePath} onSelectFile={onSelectFile} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
