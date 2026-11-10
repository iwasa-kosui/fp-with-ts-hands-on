import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import { startMeasure } from "../../code-explorer/measure";
import type { ProjectFiles } from "../../code-explorer/types";
import {
  applyAllSavedEdits,
  applySavedEdits,
  computeEdits,
  serializeEdits,
  trimTerminalOutput,
} from "../../code-explorer/workspace-persistence";
import type { WorkspaceAction } from "../../code-explorer/workspace-state";
import type {
  SavedWorkspace,
  WorkspaceStore,
} from "../../code-explorer/workspace-store";

export type WorkspacePersistenceStatus =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "active" }>
  | Readonly<{ kind: "outdated"; paths: readonly string[] }>
  | Readonly<{ kind: "conflict" }>
  | Readonly<{ kind: "save-failed" }>
  | Readonly<{ kind: "read-failed" }>;

export type WorkspacePersistenceNotice = "restored" | "lost";

export type UseWorkspacePersistenceParams = Readonly<{
  slug: string;
  projectFiles: ProjectFiles;
  visiblePaths: readonly string[];
  contents: ProjectFiles;
  selectedPath: string | undefined;
  dispatch: Dispatch<WorkspaceAction>;
  store: WorkspaceStore;
  enabled: boolean;
  writeToSession: (path: string, contents: string) => void;
}>;

export type WorkspacePersistence = Readonly<{
  status: WorkspacePersistenceStatus;
  notice: WorkspacePersistenceNotice | undefined;
  restoredOutput: string | undefined;
  outputStale: boolean;
  appendTerminalOutput: (chunk: string) => void;
  notifyCommandSent: () => void;
  chooseSavedEdits: () => void;
  chooseUpdatedCode: () => void;
  loadOtherTab: () => Promise<void>;
  overwriteOtherTab: () => Promise<void>;
  retrySave: () => Promise<void>;
}>;

const readTimeoutMs = 3000;
const viewSaveIntervalMs = 500;

const savedEditsFlagKey = (slug: string) =>
  `code-explorer:has-saved-edits:${slug}`;

const readSavedEditsFlag = (slug: string): boolean => {
  try {
    return globalThis.localStorage?.getItem(savedEditsFlagKey(slug)) === "1";
  } catch {
    return false;
  }
};

const writeSavedEditsFlag = (slug: string, hasEdits: boolean): void => {
  try {
    if (hasEdits) {
      globalThis.localStorage?.setItem(savedEditsFlagKey(slug), "1");
    } else {
      globalThis.localStorage?.removeItem(savedEditsFlagKey(slug));
    }
  } catch {
    return;
  }
};

const withTimeout = <T>(promise: Promise<T>, milliseconds: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("保存済みの編集の読み出しがタイムアウトしました。")),
      milliseconds,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

export const useWorkspacePersistence = (
  params: UseWorkspacePersistenceParams,
): WorkspacePersistence => {
  const { slug, contents, selectedPath, store, enabled } = params;
  const [status, setStatus] = useState<WorkspacePersistenceStatus>(() => ({
    kind: enabled ? "loading" : "active",
  }));
  const [notice, setNotice] = useState<WorkspacePersistenceNotice>();
  const [restoredOutput, setRestoredOutput] = useState<string>();
  const [outputStale, setOutputStale] = useState(false);

  const latest = useRef(params);
  latest.current = params;
  const statusRef = useRef(status);
  const revisionRef = useRef(0);
  const remoteRevisionRef = useRef(0);
  const lastSavedJsonRef = useRef(serializeEdits({}));
  const loadedEditsRef = useRef<SavedWorkspace["edits"]>({});
  const appliedContentsRef = useRef<ProjectFiles>();
  const previousContentsRef = useRef(contents);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const outputBufferRef = useRef("");
  const lastOutputAtRef = useRef(0);
  const outputDirtyRef = useRef(false);
  const selectedDirtyRef = useRef<string>();
  const lastSelectedPathRef = useRef<string>();
  const commandSentRef = useRef(false);
  const heldOutputRef = useRef("");
  const viewTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const updateStatus = useCallback((next: WorkspacePersistenceStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const hasUnsavedEdits = useCallback(
    () =>
      serializeEdits(
        computeEdits(latest.current.contents, latest.current.projectFiles),
      ) !== lastSavedJsonRef.current,
    [],
  );

  const flushView = useCallback(() => {
    if (viewTimerRef.current !== undefined) {
      clearTimeout(viewTimerRef.current);
      viewTimerRef.current = undefined;
    }
    const { slug: currentSlug, store: currentStore, enabled: isEnabled } =
      latest.current;
    const kind = statusRef.current.kind;
    if (!isEnabled || kind === "loading" || kind === "read-failed") return;
    if (outputDirtyRef.current) {
      outputDirtyRef.current = false;
      try {
        void currentStore
          .saveTerminalOutput(
            currentSlug,
            outputBufferRef.current,
            lastOutputAtRef.current,
          )
          .catch(() => undefined);
      } catch {
        return;
      }
    }
    const currentPath = selectedDirtyRef.current;
    if (currentPath !== undefined) {
      selectedDirtyRef.current = undefined;
      try {
        void currentStore
          .saveSelectedPath(currentSlug, currentPath)
          .catch(() => undefined);
      } catch {
        return;
      }
    }
  }, []);

  const scheduleViewSave = useCallback(() => {
    if (viewTimerRef.current !== undefined) return;
    viewTimerRef.current = setTimeout(flushView, viewSaveIntervalMs);
  }, [flushView]);

  const appendTerminalOutput = useCallback(
    (chunk: string) => {
      if (!commandSentRef.current) {
        heldOutputRef.current = trimTerminalOutput(
          heldOutputRef.current + chunk,
        );
        return;
      }
      outputBufferRef.current = trimTerminalOutput(
        outputBufferRef.current + chunk,
      );
      lastOutputAtRef.current = Date.now();
      outputDirtyRef.current = true;
      scheduleViewSave();
    },
    [scheduleViewSave],
  );

  const notifyCommandSent = useCallback(() => {
    commandSentRef.current = true;
    if (heldOutputRef.current === "") return;
    outputBufferRef.current = trimTerminalOutput(
      outputBufferRef.current + heldOutputRef.current,
    );
    heldOutputRef.current = "";
    outputDirtyRef.current = true;
    scheduleViewSave();
  }, [scheduleViewSave]);

  const flushSave = useCallback(
    async (force: boolean): Promise<void> => {
      if (savingRef.current) {
        pendingSaveRef.current = true;
        return;
      }
      savingRef.current = true;
      let first = true;
      try {
        do {
          pendingSaveRef.current = false;
          const kind = statusRef.current.kind;
          if (
            !latest.current.enabled ||
            (kind !== "active" && kind !== "save-failed")
          ) {
            break;
          }
          const { slug: currentSlug, store: currentStore } = latest.current;
          const edits = computeEdits(
            latest.current.contents,
            latest.current.projectFiles,
          );
          const json = serializeEdits(edits);
          if (json === lastSavedJsonRef.current && !(force && first)) break;
          first = false;

          let result;
          try {
            result = await currentStore.saveEdits(
              currentSlug,
              edits,
              revisionRef.current,
            );
          } catch {
            const afterKind = statusRef.current.kind;
            if (afterKind === "active" || afterKind === "save-failed") {
              updateStatus({ kind: "save-failed" });
            }
            break;
          }

          if (result.kind === "conflict") {
            remoteRevisionRef.current = result.revision;
            updateStatus({ kind: "conflict" });
            break;
          }

          revisionRef.current = result.revision;
          lastSavedJsonRef.current = json;
          writeSavedEditsFlag(currentSlug, Object.keys(edits).length > 0);
          if (statusRef.current.kind === "save-failed") {
            updateStatus({ kind: "active" });
          }
          setNotice((current) => (current === "lost" ? undefined : current));
        } while (pendingSaveRef.current);
      } finally {
        savingRef.current = false;
      }
    },
    [updateStatus],
  );

  const reloadFromStore = useCallback(
    async (guardUnsaved: boolean): Promise<void> => {
      const {
        slug: currentSlug,
        store: currentStore,
        projectFiles,
        visiblePaths,
        dispatch,
        writeToSession,
      } = latest.current;
      const loaded = await currentStore.load(currentSlug);
      const revision = loaded.workspace?.revision ?? 0;
      if (guardUnsaved && hasUnsavedEdits()) {
        remoteRevisionRef.current = revision;
        updateStatus({ kind: "conflict" });
        return;
      }
      const edits = loaded.workspace?.edits ?? {};
      const applied = applyAllSavedEdits(projectFiles, visiblePaths, edits);
      const previous = latest.current.contents;
      revisionRef.current = revision;
      loadedEditsRef.current = edits;
      lastSavedJsonRef.current = serializeEdits(
        computeEdits(applied.contents, projectFiles),
      );
      appliedContentsRef.current = applied.contents;
      dispatch({
        kind: "restore",
        contents: applied.contents,
        visiblePaths: applied.visiblePaths,
      });
      for (const [path, value] of Object.entries(applied.contents)) {
        if (previous[path] !== value) writeToSession(path, value);
      }
      updateStatus({ kind: "active" });
    },
    [hasUnsavedEdits, updateStatus],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const endMeasure = startMeasure("code-explorer:read-saved-state");

    const run = async () => {
      const { projectFiles, visiblePaths, dispatch } = latest.current;
      try {
        const loaded = await withTimeout(store.load(slug), readTimeoutMs);
        endMeasure();
        if (cancelled) return;

        const workspace = loaded.workspace;
        const view = loaded.view;
        const applied = applySavedEdits(
          projectFiles,
          visiblePaths,
          workspace?.edits ?? {},
        );
        const outdated = applied.outdatedPaths.length > 0;
        const appliedCount =
          Object.keys(workspace?.edits ?? {}).length -
          applied.outdatedPaths.length;

        revisionRef.current = workspace?.revision ?? 0;
        loadedEditsRef.current = workspace?.edits ?? {};
        lastSavedJsonRef.current = outdated
          ? serializeEdits(workspace?.edits ?? {})
          : serializeEdits(computeEdits(applied.contents, projectFiles));
        appliedContentsRef.current = applied.contents;
        outputBufferRef.current = view?.output ?? "";
        lastOutputAtRef.current = view?.lastOutputAt ?? 0;
        lastSelectedPathRef.current = view?.selectedPath;

        dispatch({
          kind: "restore",
          contents: applied.contents,
          visiblePaths: applied.visiblePaths,
          ...(view?.selectedPath === undefined
            ? {}
            : { selectedPath: view.selectedPath }),
        });
        setRestoredOutput(view?.output);
        setOutputStale(
          view !== undefined &&
            workspace !== undefined &&
            view.lastOutputAt < workspace.updatedAt,
        );

        if (outdated) {
          updateStatus({ kind: "outdated", paths: applied.outdatedPaths });
          return;
        }
        if (workspace === undefined && readSavedEditsFlag(slug)) {
          setNotice("lost");
        } else if (appliedCount > 0) {
          setNotice("restored");
        }
        updateStatus({ kind: "active" });
      } catch {
        endMeasure();
        if (!cancelled) updateStatus({ kind: "read-failed" });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, slug, store, updateStatus]);

  useEffect(() => {
    if (!enabled) return;
    return store.subscribe(slug, (revision) => {
      if (revision === revisionRef.current) return;
      const kind = statusRef.current.kind;
      if (kind === "conflict") {
        remoteRevisionRef.current = revision;
        return;
      }
      if (kind !== "active" && kind !== "save-failed") return;
      if (savingRef.current) return;
      if (hasUnsavedEdits()) {
        remoteRevisionRef.current = revision;
        updateStatus({ kind: "conflict" });
        return;
      }
      void reloadFromStore(true).catch(() => undefined);
    });
  }, [enabled, hasUnsavedEdits, reloadFromStore, slug, store, updateStatus]);

  useEffect(() => {
    const contentsChanged = previousContentsRef.current !== contents;
    previousContentsRef.current = contents;
    if (!enabled) return;
    const kind = status.kind;
    if (kind === "loading" || kind === "outdated" || kind === "read-failed") {
      return;
    }
    if (contentsChanged && contents !== appliedContentsRef.current) {
      setOutputStale(true);
    }
    if (kind === "active" || (kind === "save-failed" && contentsChanged)) {
      void flushSave(false);
    }
  }, [contents, enabled, flushSave, status.kind]);

  useEffect(() => {
    if (!enabled) return;
    const kind = statusRef.current.kind;
    if (kind === "loading" || kind === "read-failed") return;
    if (selectedPath === undefined || selectedPath === lastSelectedPathRef.current) {
      return;
    }
    lastSelectedPathRef.current = selectedPath;
    selectedDirtyRef.current = selectedPath;
    scheduleViewSave();
  }, [enabled, scheduleViewSave, selectedPath]);

  useEffect(() => {
    window.addEventListener("pagehide", flushView);
    return () => {
      window.removeEventListener("pagehide", flushView);
      flushView();
    };
  }, [flushView]);

  useEffect(() => {
    if (
      status.kind !== "conflict" &&
      status.kind !== "save-failed" &&
      status.kind !== "read-failed"
    ) {
      return;
    }
    if (!hasUnsavedEdits()) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [contents, hasUnsavedEdits, status.kind]);

  const chooseSavedEdits = useCallback(() => {
    if (statusRef.current.kind !== "outdated") return;
    const { projectFiles, visiblePaths, dispatch } = latest.current;
    const applied = applyAllSavedEdits(
      projectFiles,
      visiblePaths,
      loadedEditsRef.current,
    );
    appliedContentsRef.current = applied.contents;
    dispatch({
      kind: "restore",
      contents: applied.contents,
      visiblePaths: applied.visiblePaths,
    });
    updateStatus({ kind: "active" });
  }, [updateStatus]);

  const chooseUpdatedCode = useCallback(() => {
    if (statusRef.current.kind !== "outdated") return;
    updateStatus({ kind: "active" });
  }, [updateStatus]);

  const loadOtherTab = useCallback(async () => {
    if (statusRef.current.kind !== "conflict") return;
    try {
      await reloadFromStore(false);
    } catch {
      return;
    }
  }, [reloadFromStore]);

  const overwriteOtherTab = useCallback(async () => {
    if (statusRef.current.kind !== "conflict") return;
    revisionRef.current = remoteRevisionRef.current;
    updateStatus({ kind: "active" });
    await flushSave(true);
  }, [flushSave, updateStatus]);

  const retrySave = useCallback(async () => {
    if (statusRef.current.kind !== "save-failed") return;
    await flushSave(true);
  }, [flushSave]);

  return {
    status,
    notice,
    restoredOutput,
    outputStale,
    appendTerminalOutput,
    notifyCommandSent,
    chooseSavedEdits,
    chooseUpdatedCode,
    loadOtherTab,
    overwriteOtherTab,
    retrySave,
  };
};
