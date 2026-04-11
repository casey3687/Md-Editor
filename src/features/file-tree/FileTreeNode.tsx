export type FileTreeNode = {
  name: string;
  path: string;
  kind: "file" | "folder";
  children?: FileTreeNode[];
};

type FileTreeNodeProps = {
  node: FileTreeNode;
  activePath: string | null;
  onSelectFile: (path: string) => void;
};

export function FileTreeNodeView({ node, activePath, onSelectFile }: FileTreeNodeProps) {
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
            <FileTreeNodeView key={child.path} node={child} activePath={activePath} onSelectFile={onSelectFile} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
