import ts from "typescript";
import { describe, expect, it } from "vitest";
import { frames, noShowError, remainingOf, type Frame } from "./never-switch-frames";

const fileName = "/virtual/status.ts";
const options: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  types: [],
};

const programOf = (source: string): ts.Program => {
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) =>
    name === fileName
      ? ts.createSourceFile(name, source, languageVersion, true)
      : original(name, languageVersion, onError, shouldCreate);
  host.fileExists = (name) => name === fileName || ts.sys.fileExists(name);
  host.readFile = (name) => (name === fileName ? source : ts.sys.readFile(name));
  return ts.createProgram([fileName], options, host);
};

const diagnosticsOf = (source: string) => ts.getPreEmitDiagnostics(programOf(source));

const statusDeclarationOf = (frame: Frame): string => frame.code.split("\n")[0]!;

const switchWithHandled = (frame: Frame): string =>
  [
    statusDeclarationOf(frame),
    "const probe = (status: Status): string => {",
    "  switch (status) {",
    ...frame.cards.filter((card) => card.done).map((card) => `    case "${card.name}": return "";`),
    "    default: {",
    "      const inDefault = status;",
    "      return String(inDefault);",
    "    }",
    "  }",
    "};",
  ].join("\n");

const candidatesInDefault = (source: string): { names: string[]; isNever: boolean } => {
  const program = programOf(source);
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(fileName)!;
  let found: ts.Type | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.name.getText() === "inDefault") {
      found = checker.getTypeAtLocation(node.initializer!);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (found === undefined) throw new Error("inDefault is not in the source");
  const types = found.isUnion() ? found.types : [found];
  return {
    names: types.flatMap((type) => (type.isStringLiteral() ? [type.value] : [])),
    isNever: (found.flags & ts.TypeFlags.Never) !== 0,
  };
};

describe("never-switch-frames", () => {
  it.each(frames.map((frame, index) => [index, frame] as const))(
    "コマ%i: default の status の型の候補が、画面の残る候補と一致する",
    (_index, frame) => {
      const { names, isNever } = candidatesInDefault(switchWithHandled(frame));
      expect(new Set(names)).toEqual(new Set(remainingOf(frame)));
      expect(isNever).toBe(remainingOf(frame).length === 0);
    },
  );

  it("コマ3とコマ4の候補は空で、型は never", () => {
    for (const frame of [frames[3]!, frames[4]!]) {
      expect(remainingOf(frame)).toEqual([]);
      expect(candidatesInDefault(switchWithHandled(frame)).isNever).toBe(true);
    }
  });

  it("コマ4の完全なコードは、型検査のエラーが0件", () => {
    expect(diagnosticsOf(frames[4]!.code)).toEqual([]);
  });

  it("コマ5の完全なコードは、rest の行のエラー1件だけで、画面のエラー文面と一致する", () => {
    const frame = frames[5]!;
    const diagnostics = diagnosticsOf(frame.code);
    expect(diagnostics).toHaveLength(1);
    const [diagnostic] = diagnostics;
    const message = ts.flattenDiagnosticMessageText(diagnostic!.messageText, "\n");
    expect(message).toBe(noShowError);
    expect(frame.verdict).toMatchObject({ kind: "error", message });
    const position = diagnostic!.file!.getLineAndCharacterOfPosition(diagnostic!.start!);
    expect(frame.code.split("\n")[position.line]).toContain("const rest");
    expect(frame.negative).toEqual([position.line]);
  });
});
