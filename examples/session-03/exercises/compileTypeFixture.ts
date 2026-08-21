import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(directory, "..");
const configPath = path.join(projectDirectory, "tsconfig.json");

const compile = (entryPath: string, stripNoCheck: boolean): ReadonlyArray<string> => {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectDirectory);
  const host = ts.createCompilerHost({ ...parsed.options, noEmit: true });
  const readFile = host.readFile.bind(host);

  host.readFile = (fileName) => {
    const source = readFile(fileName);
    if (source === undefined) return source;
    if (stripNoCheck && fileName === entryPath) return source.replace("// @ts-nocheck\n", "");
    return source;
  };

  const program = ts.createProgram({
    rootNames: [entryPath],
    options: { ...parsed.options, noEmit: true },
    host,
  });

  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
};

export const compileTypeFixture = (fixtureName: string): ReadonlyArray<string> =>
  compile(path.join(directory, "type-fixtures", fixtureName), true);

export const compileProjectFile = (relativePath: string): ReadonlyArray<string> =>
  compile(path.join(projectDirectory, relativePath), false);
