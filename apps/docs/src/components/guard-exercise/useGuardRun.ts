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
import {
  runCommandTimedOutExitCode,
  type TerminalSession,
} from "../../code-explorer/runner";
import type { GuardWorkspaceStore } from "../../code-explorer/workspace-store";

export type GuardRunStep =
  | "starting"
  | "judging"
  | "waiting"
  | "rejudging"
  | "reading";

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
  releaseSession: () => Promise<void>;
}>;

const limitationSaveDelayMs = 400;

const maxHiddenRetries = 2;

const guardCommandTimeoutMs = 130_000;

const isHidden = (): boolean => document.visibilityState === "hidden";

const waitUntilVisible = (): Promise<void> =>
  new Promise((resolve) => {
    if (!isHidden()) {
      resolve();
      return;
    }
    const onChange = () => {
      if (isHidden()) return;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    document.addEventListener("visibilitychange", onChange);
  });

const messageFrom = (error: unknown): string =>
  error instanceof Error ? error.message : "検出を確かめられませんでした。";

export const useGuardRun = ({
  store,
  slug,
  acquireSession,
  releaseSession,
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
  const latest = useRef({ store, slug, acquireSession, releaseSession });
  latest.current = { store, slug, acquireSession, releaseSession };

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
          "前回の結果を読み出せませんでした。この画面の結果と記入は保存されません。",
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
      for (let attempt = 0; ; attempt += 1) {
        if (mounted.current) setStatus({ kind: "running", step: "starting" });
        const session = await latest.current.acquireSession();
        const { runCommand, readFile } = session;
        if (runCommand === undefined || readFile === undefined) {
          throw new Error("この実行環境では検出を確かめられません。");
        }
        if (mounted.current) {
          setStatus({
            kind: "running",
            step: attempt === 0 ? "judging" : "rejudging",
          });
        }
        let hiddenSeen = isHidden();
        const onVisibilityChange = () => {
          if (isHidden()) hiddenSeen = true;
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        let parsed: GuardResult | undefined;
        let exitCode: number | undefined;
        try {
          exitCode = await runCommand(
            guardCommand.command,
            guardCommand.args,
            guardCommandSize,
            { timeoutMs: guardCommandTimeoutMs },
          );
          if (
            exitCode !== 0 &&
            exitCode !== 1 &&
            exitCode !== runCommandTimedOutExitCode
          ) {
            throw new Error(
              `検出の確認が途中で終了しました（終了コード ${exitCode}）。ターミナルを開くと出力を確認できます。`,
            );
          }
          if (mounted.current) setStatus({ kind: "running", step: "reading" });
          const text = await readFile(guardPaths.result);
          parsed = text === undefined ? undefined : parseGuardResult(text);
        } finally {
          document.removeEventListener("visibilitychange", onVisibilityChange);
        }
        const needsFreshRuntime =
          parsed === undefined ||
          parsed.testsTimedOut === true ||
          exitCode === runCommandTimedOutExitCode;
        // WebContainer では終わらないテストのプロセスを止められないので、環境ごと作り直す。
        if (needsFreshRuntime) await latest.current.releaseSession();
        // 隠れたタブでは WebContainer の処理がほぼ止まるので、その間の時間切れは参加者の誤りとして見せない。
        const stalled =
          hiddenSeen &&
          (parsed === undefined ||
            parsed.testsTimedOut === true ||
            parsed.testCaseTimedOut === true);
        if (stalled && attempt < maxHiddenRetries) {
          if (mounted.current) setStatus({ kind: "running", step: "waiting" });
          await waitUntilVisible();
          if (!mounted.current) return;
          continue;
        }
        if (parsed === undefined) {
          throw new Error(
            exitCode === runCommandTimedOutExitCode
              ? "検出を確かめる処理が時間内に終わりませんでした。eslint.config.mjs の規則やテストに、終わらない繰り返しがないか見直します。"
              : "結果を読み出せませんでした。もう一度「検出を確かめる」を押してください。",
          );
        }
        const { store: currentStore, slug: currentSlug } = latest.current;
        void currentStore
          .saveGuardResult(currentSlug, parsed, Date.now())
          .catch(() => {
            if (mounted.current) {
              setNotice("結果を保存できませんでした。");
            }
          });
        if (mounted.current) {
          hasFreshResult.current = true;
          setResult(parsed);
          setSource("fresh");
          setStatus({ kind: "idle" });
        }
        return;
      }
    } catch (error: unknown) {
      if (mounted.current) {
        setStatus({ kind: "failed", message: messageFrom(error) });
        // この実行の結果はないので、残っている表は前回の結果として見せる。
        setSource((current) => (current === "none" ? "none" : "restored"));
      }
    } finally {
      running.current = false;
    }
  }, []);

  return { status, result, source, limitations, ready, notice, run, setLimitation };
};
