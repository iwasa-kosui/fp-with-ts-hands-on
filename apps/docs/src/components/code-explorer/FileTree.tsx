import { useId } from "react";

type DirectoryNode = {
  name: string;
  path: string;
  directories: Map<string, DirectoryNode>;
  files: Map<string, string>;
};

export type FileTreeProps = Readonly<{
  paths: readonly string[];
  selectedPath: string;
  dirtyPaths: ReadonlySet<string>;
  disabled: boolean;
  onSelect: (path: string) => void;
}>;

const createDirectory = (name: string, path: string): DirectoryNode => ({
  name,
  path,
  directories: new Map(),
  files: new Map(),
});

const buildTree = (paths: readonly string[]): DirectoryNode => {
  const root = createDirectory("", "");

  for (const path of paths) {
    const segments = path.split("/");
    let directory = root;

    for (const name of segments.slice(0, -1)) {
      const childPath =
        directory.path === "" ? name : `${directory.path}/${name}`;
      const child =
        directory.directories.get(name) ?? createDirectory(name, childPath);
      directory.directories.set(name, child);
      directory = child;
    }

    const fileName = segments.at(-1);
    if (fileName !== undefined) directory.files.set(fileName, path);
  }

  return root;
};

const DirectoryItems = ({
  directory,
  selectedPath,
  dirtyPaths,
  disabled,
  onSelect,
  treeId,
}: Readonly<{
  directory: DirectoryNode;
  selectedPath: string;
  dirtyPaths: ReadonlySet<string>;
  disabled: boolean;
  onSelect: (path: string) => void;
  treeId: string;
}>) => (
  <>
    {[...directory.directories.values()].map((child) => {
      const labelId = `${treeId}-folder-${encodeURIComponent(child.path)}`;
      return (
        <li key={`directory:${child.path}`}>
          <span id={labelId} className="code-explorer__folder">
            {child.name}
          </span>
          <ul aria-labelledby={labelId}>
            <DirectoryItems
              directory={child}
              selectedPath={selectedPath}
              dirtyPaths={dirtyPaths}
              disabled={disabled}
              onSelect={onSelect}
              treeId={treeId}
            />
          </ul>
        </li>
      );
    })}
    {[...directory.files].map(([fileName, path]) => (
      <li key={`file:${path}`}>
        <button
          type="button"
          data-path={path}
          aria-pressed={path === selectedPath}
          aria-label={`${path}${dirtyPaths.has(path) ? "、変更あり" : ""}`}
          disabled={disabled}
          onClick={() => onSelect(path)}
        >
          <span>{fileName}</span>
          {dirtyPaths.has(path) ? (
            <span className="code-explorer__dirty">変更あり</span>
          ) : null}
        </button>
      </li>
    ))}
  </>
);

export const FileTree = ({
  paths,
  selectedPath,
  dirtyPaths,
  disabled,
  onSelect,
}: FileTreeProps) => {
  const root = buildTree(paths);
  const treeId = useId();

  return (
    <nav aria-label="教材ファイル">
      <ul>
        <DirectoryItems
          directory={root}
          selectedPath={selectedPath}
          dirtyPaths={dirtyPaths}
          disabled={disabled}
          onSelect={onSelect}
          treeId={treeId}
        />
      </ul>
    </nav>
  );
};
