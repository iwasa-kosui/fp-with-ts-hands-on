export type FileTabsProps = Readonly<{
  paths: readonly string[];
  selectedPath: string;
  dirtyPaths: ReadonlySet<string>;
  disabled: boolean;
  onSelect: (path: string) => void;
}>;

export const FileTabs = ({
  paths,
  selectedPath,
  dirtyPaths,
  disabled,
  onSelect,
}: FileTabsProps) => (
  <nav aria-label="開いているファイル" className="code-explorer__tabs">
    {paths.map((path) => (
      <button
        key={path}
        type="button"
        data-path={path}
        title={path}
        aria-pressed={path === selectedPath}
        aria-label={`${path}${dirtyPaths.has(path) ? "、変更あり" : ""}`}
        disabled={disabled}
        onClick={() => onSelect(path)}
      >
        <span>{path.split("/").at(-1)}</span>
        {dirtyPaths.has(path) ? (
          <span className="code-explorer__dirty">変更あり</span>
        ) : null}
      </button>
    ))}
  </nav>
);
