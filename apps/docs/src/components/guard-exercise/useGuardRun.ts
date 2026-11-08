import { useCallback, useEffect, useRef, useState } from "react";
import {
  guardCommand,
  guardCommandSize,
  guardPaths,
} from "../../code-explorer/guard-paths";
import {
  parseGuardResult,
  type GuardResult,
} from "../../code-explorer/guard-result";
import type { TerminalSession } from "../../code-explorer/runner";
import type { GuardWorkspaceStore } from "../../code-explorer/workspace-store";

export type GuardRunStep = "starting" | "judging" | "reading";

export type GuardRunStatus =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "running"; step: GuardRunStep }>
  | Readonly<{ kind: "failed"; message: string }>;

export type GuardResultSource = "none" | "restored" | "fresh";

export type GuardRun = Readonly<{
  status: GuardRunStatus;
  result: GuardResult | undefined;
  source: GuardResultSource;
  limitations: Readonly<Record<string, string>>;
  ready: boolean;
  notice: string | undefined;
  run: () => Promise<void>;
  setLimitation: (id: string, text: string) => void;
}>;

export type UseGuardRunParams = Readonly<{
  store: GuardWorkspaceStore;
  slug: string;
  acquireSession: () => Promise<TerminalSession>;
}>;

const limitationSaveDelayMs = 400;

const messageFrom = (error: unknown): string =>
  error instanceof Error ? error.message : "検査を実行できませんでした。";

export const useGuardRun = ({
  store,
  slug,
  acquireSession,
}: UseGuardRunParams): GuardRun => {
  const [status, setStatus] = useState<GuardRunStatus>({ kind: "idle" });
  const [result, setResult] = useState<GuardResult>();
  const [source, setSource] = useState<GuardResultSource>("none");
  const [limitations, setLimitations] = useState<
    Readonly<Record<string, string>>
  >({});
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string>();

  const mounted = useRef(true);
  const running = useRef(false);
  const hasFreshResult = useRef(false);
  const latestLimitations = useRef(limitations);
  const limitationsDirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef({ store, slug, acquireSession });
  latest.current = { store, slug, acquireSession };

  const flushLimitations = useCallback(() => {
    if (saveTimer.current !== undefined) {
      clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
    }
    if (!limitationsDirty.current) return;
    limitationsDirty.current = false;
    const { store: currentStore, slug: currentSlug } = latest.current;
    void currentStore
      .saveLimitations(currentSlug, latestLimitations.current)
      .catch(() => {
        if (mounted.current) {
          setNotice("書いた内容を保存できませんでした。");
        }
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void store.load(slug).then(
      ({ view }) => {
        if (cancelled) return;
        if (view?.guardResult !== undefined && !hasFreshResult.current) {
          setResult(view.guardResult);
          setSource("restored");
        }
        if (view?.limitations !== undefined) {
          latestLimitations.current = view.limitations;
          setLimitations(view.limitations);
        }
        setReady(true);
      },
      () => {
        if (cancelled) return;
        setNotice(
          "前回の検査の結果を読み出せませんでした。この画面の結果と記入は保存されません。",
        );
        setReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [slug, store]);

  useEffect(() => {
    window.addEventListener("pagehide", flushLimitations);
    return () => {
      window.removeEventListener("pagehide", flushLimitations);
      mounted.current = false;
      flushLimitations();
    };
  }, [flushLimitations]);

  const setLimitation = useCallback(
    (id: string, text: string) => {
      const next = { ...latestLimitations.current, [id]: text };
      latestLimitations.current = next;
      limitationsDirty.current = true;
      setLimitations(next);
      if (saveTimer.current !== undefined) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flushLimitations, limitationSaveDelayMs);
    },
    [flushLimitations],
  );

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setStatus({ kind: "running", step: "starting" });
    try {
      const session = await latest.current.acquireSession();
      const { runCommand, readFile } = session;
      if (runCommand === undefined || readFile === undefined) {
        throw new Error("この実行環境では検査を実行できません。");
      }
      if (mounted.current) setStatus({ kind: "running", step: "judging" });
      const exitCode = await runCommand(
        guardCommand.command,
        guardCommand.args,
        guardCommandSize,
      );
      if (exitCode !== 0 && exitCode !== 1) {
        throw new Error(
          `検査が途中で終了しました（終了コード ${exitCode}）。ターミナルを開くと出力を確認できます。`,
        );
      }
      if (mounted.current) setStatus({ kind: "running", step: "reading" });
      const text = await readFile(guardPaths.result);
      const parsed = text === undefined ? undefined : parseGuardResult(text);
      if (parsed === undefined) {
        throw new Error(
          "検査の結果を読み出せませんでした。ターミナルを開くと出力を確認できます。",
        );
      }
      const { store: currentStore, slug: currentSlug } = latest.current;
      void currentStore
        .saveGuardResult(currentSlug, parsed, Date.now())
        .catch(() => {
          if (mounted.current) {
            setNotice("検査の結果を保存できませんでした。");
          }
        });
      if (mounted.current) {
        hasFreshResult.current = true;
        setResult(parsed);
        setSource("fresh");
        setStatus({ kind: "idle" });
      }
    } catch (error: unknown) {
      if (mounted.current) {
        setStatus({ kind: "failed", message: messageFrom(error) });
      }
    } finally {
      running.current = false;
    }
  }, []);

  return { status, result, source, limitations, ready, notice, run, setLimitation };
};
