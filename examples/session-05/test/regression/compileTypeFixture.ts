import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(directory, "..", "..");
const configPath = path.join(projectDirectory, "tsconfig.json");
const exhaustiveFixture = "s1-status-exhaustive.ts";

const printWithSixthAppointmentState = (fileName: string, source: string): string => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const transformed = ts.transform(sourceFile, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        if (ts.isTypeAliasDeclaration(node) && node.name.text === "Appointment" && ts.isUnionTypeNode(node.type)) {
          const deferred = ts.factory.createTypeReferenceNode("Readonly", [
            ts.factory.createTypeLiteralNode([
              ts.factory.createPropertySignature(undefined, "kind", undefined, ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral("Deferred"))),
            ]),
          ]);
          return ts.factory.updateTypeAliasDeclaration(
            node,
            node.modifiers,
            node.name,
            node.typeParameters,
            ts.factory.updateUnionTypeNode(node.type, ts.factory.createNodeArray([...node.type.types, deferred])),
          );
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit) as ts.SourceFile;
    },
  ]);
  const outputSource = transformed.transformed[0];
  if (outputSource === undefined) throw new Error("Appointment transform produced no source file");
  const output = ts.createPrinter().printFile(outputSource);
  transformed.dispose();
  return output;
};

const printWithExpectedExhaustivenessError = (fileName: string, source: string): string => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const transformed = ts.transform(sourceFile, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        if (ts.isDefaultClause(node) && node.statements.length > 0) {
          const first = node.statements[0];
          if (first === undefined) return node;
          return ts.factory.updateDefaultClause(node, [
            ts.addSyntheticLeadingComment(
              first,
              ts.SyntaxKind.SingleLineCommentTrivia,
              " @ts-expect-error A new appointment state must make this branch fail to compile.",
              true,
            ),
            ...node.statements.slice(1),
          ]);
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit) as ts.SourceFile;
    },
  ]);
  const outputSource = transformed.transformed[0];
  if (outputSource === undefined) throw new Error("Status label transform produced no source file");
  const output = ts.createPrinter().printFile(outputSource);
  transformed.dispose();
  return output;
};

export const compileTypeFixture = (fixtureName: string): ReadonlyArray<string> => {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectDirectory);
  const fixturePath = path.join(directory, "type-fixtures", fixtureName);
  const verifiesExhaustiveness = fixtureName === exhaustiveFixture;
  const appointmentPath = path.join(projectDirectory, "src/domain/appointment/appointment.ts");
  const statusLabelPath = path.join(projectDirectory, "src/domain/appointment/statusLabel.ts");
  const host = ts.createCompilerHost({ ...parsed.options, noEmit: true });
  const readFile = host.readFile.bind(host);

  host.readFile = (fileName) => {
    const source = readFile(fileName);
    if (source === undefined) return source;
    if (fileName === fixturePath) return source.replace("// @ts-nocheck\n", "");
    if (verifiesExhaustiveness && fileName === appointmentPath) return printWithSixthAppointmentState(fileName, source);
    if (verifiesExhaustiveness && fileName === statusLabelPath) return printWithExpectedExhaustivenessError(fileName, source);
    return source;
  };

  const program = ts.createProgram({
    rootNames: verifiesExhaustiveness ? [fixturePath, statusLabelPath] : [fixturePath],
    options: { ...parsed.options, noEmit: true },
    host,
  });

  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
};
