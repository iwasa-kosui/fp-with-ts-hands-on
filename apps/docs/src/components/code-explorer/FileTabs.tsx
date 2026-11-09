import {
  type CSSProperties,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { guardPaths } from "../../code-explorer/guard-paths";

export type FileTabsProps = Readonly<{
  paths: readonly string[];
  allPaths: readonly string[];
  selectedPath: string;
  dirtyPaths: ReadonlySet<string>;
  disabled: boolean;
  onSelect: (path: string) => void;
}>;

const fileNameOf = (path: string): string => path.split("/").at(-1) ?? path;

const folderOf = (path: string): string => path.slice(0, path.lastIndexOf("/") + 1);

const folderOrder = ["", guardPaths.mine, guardPaths.cases, guardPaths.subjects];

const groupByFolder = (
  paths: readonly string[],
): readonly Readonly<{ folder: string; paths: readonly string[] }>[] => {
  const byFolder = new Map<string, string[]>();
  for (const path of paths) {
    const folder = folderOf(path);
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), path]);
  }
  const rank = (folder: string): number => {
    const index = folderOrder.indexOf(folder);
    return index === -1 ? folderOrder.length : index;
  };
  return [...byFolder.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0))
    .map(([folder, folderPaths]) => ({
      folder,
      paths: [...folderPaths].sort((a, b) => {
        const nameA = fileNameOf(a);
        const nameB = fileNameOf(b);
        return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
      }),
    }));
};

const stemOf = (name: string): string => {
  const dot = name.indexOf(".");
  return dot >= 1 ? name.slice(0, dot) : name;
};

export const FileTabs = ({
  paths,
  allPaths,
  selectedPath,
  dirtyPaths,
  disabled,
  onSelect,
}: FileTabsProps) => {
  const [listOpen, setListOpen] = useState(false);
  const listId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !areaRef.current?.contains(event.target)
      ) {
        setListOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setListOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [listOpen]);

  useEffect(() => {
    if (disabled) setListOpen(false);
  }, [disabled]);

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
    <div ref={areaRef} className="code-explorer__tabs-area">
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
        <button
          type="button"
          ref={toggleRef}
          className="code-explorer__path-toggle"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-label={`${selectedPath}、すべてのファイルの一覧`}
          disabled={disabled}
          onClick={() => setListOpen((open) => !open)}
        >
          <span className="code-explorer__path">
            {folder === "" ? null : (
              <span className="code-explorer__path-folder">{folder}</span>
            )}
            <strong>{fileName}</strong>
          </span>
          <span className="code-explorer__path-action" aria-hidden="true">
            一覧 ▾
          </span>
        </button>
      )}
      {listOpen ? (
        <div
          id={listId}
          className="code-explorer__file-list"
          role="group"
          aria-label="すべてのファイル"
        >
          {groupByFolder(allPaths).map(({ folder: groupFolder, paths: groupPaths }) => (
            <section key={groupFolder}>
              <h3 className="code-explorer__file-list-folder">
                {groupFolder === "" ? "プロジェクトの直下" : groupFolder}
              </h3>
              <ul>
                {groupPaths.map((path) => (
                  <li key={path}>
                    <button
                      type="button"
                      data-file-list-path={path}
                      aria-current={path === selectedPath ? "true" : undefined}
                      onClick={() => {
                        onSelect(path);
                        setListOpen(false);
                        toggleRef.current?.focus();
                      }}
                    >
                      <span>{fileNameOf(path)}</span>
                      {dirtyPaths.has(path) ? (
                        <span className="code-explorer__dirty">変更あり</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
};
