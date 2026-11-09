import type { CSSProperties } from "react";

export type FileTabsProps = Readonly<{
  paths: readonly string[];
  selectedPath: string;
  dirtyPaths: ReadonlySet<string>;
  disabled: boolean;
  onSelect: (path: string) => void;
}>;

const fileNameOf = (path: string): string => path.split("/").at(-1) ?? path;

const stemOf = (name: string): string => {
  const dot = name.indexOf(".");
  return dot >= 1 ? name.slice(0, dot) : name;
};

export const FileTabs = ({
  paths,
  selectedPath,
  dirtyPaths,
  disabled,
  onSelect,
}: FileTabsProps) => {
  const separatorIndex = selectedPath.lastIndexOf("/");
  const folder = selectedPath.slice(0, separatorIndex + 1);
  const fileName = selectedPath.slice(separatorIndex + 1);
  const names = paths.map(fileNameOf);
  const stemCounts = new Map<string, number>();
  for (const name of names) {
    const stem = stemOf(name);
    stemCounts.set(stem, (stemCounts.get(stem) ?? 0) + 1);
  }

  return (
    <div className="code-explorer__tabs-area">
      <nav aria-label="開いているファイル" className="code-explorer__tabs">
        {paths.map((path) => {
          const name = fileNameOf(path);
          const stem = stemOf(name);
          const keepsTail = (stemCounts.get(stem) ?? 0) >= 2;
          const tail = name.slice(stem.length);
          return (
            <button
              key={path}
              type="button"
              data-path={path}
              title={path}
              aria-pressed={path === selectedPath}
              aria-label={`${path}${dirtyPaths.has(path) ? "、変更あり" : ""}`}
              disabled={disabled}
              onClick={() => onSelect(path)}
              style={
                keepsTail
                  ? ({ "--tab-tail": `${tail.length * 0.5}em` } as CSSProperties)
                  : undefined
              }
            >
              {keepsTail ? (
                <>
                  <span>{stem}</span>
                  <span className="code-explorer__tab-tail">{tail}</span>
                </>
              ) : (
                <span>{name}</span>
              )}
              {dirtyPaths.has(path) ? (
                <span className="code-explorer__dirty">変更あり</span>
              ) : null}
            </button>
          );
        })}
      </nav>
      {selectedPath === "" ? null : (
        <p className="code-explorer__path">
          {folder === "" ? null : (
            <span className="code-explorer__path-folder">{folder}</span>
          )}
          <strong>{fileName}</strong>
        </p>
      )}
    </div>
  );
};
