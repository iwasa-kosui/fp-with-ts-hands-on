import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(directory, "..");
const configPath = path.join(projectDirectory, "tsconfig.json");

export const compileTypeFixture = (fixtureName: string): ReadonlyArray<string> => {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectDirectory);
  const fixturePath = path.join(directory, "type-fixtures", fixtureName);
  const host = ts.createCompilerHost({ ...parsed.options, noEmit: true });
  const readFile = host.readFile.bind(host);

  host.readFile = (fileName) => {
    const source = readFile(fileName);
    return fileName === fixturePath && source !== undefined
      ? source.replace("// @ts-nocheck\n", "")
      : source;
  };

  const program = ts.createProgram({
    rootNames: [fixturePath],
    options: { ...parsed.options, noEmit: true },
    host,
  });

  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
};
