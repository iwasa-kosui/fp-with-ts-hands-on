import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright-core";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const webContainerDistDirectory = dirname(
  fileURLToPath(import.meta.resolve("@webcontainer/api")),
);

const totalTimeoutMilliseconds = 10 * 60 * 1000;
const partSize = 20 * 1024 * 1024;
const uploadChunkSize = 4 * 1024 * 1024;

const { values } = parseArgs({ options: { out: { type: "string" } } });
if (values.out === undefined) {
  console.error("Usage: build-deps-snapshot.mjs --out <dir>");
  process.exit(1);
}
const outputDirectory = resolve(values.out);

const withoutWorkspaceDependencies = (dependencies) =>
  dependencies === undefined
    ? undefined
    : Object.fromEntries(
        Object.entries(dependencies).filter(
          ([, version]) => !version.startsWith("workspace:"),
        ),
      );

const buildPackageJson = async () => {
  const source = JSON.parse(
    await readFile(
      join(repositoryRoot, "examples/session-06/package.json"),
      "utf8",
    ),
  );
  const packageJson = {
    ...source,
    dependencies: withoutWorkspaceDependencies(source.dependencies),
    devDependencies: withoutWorkspaceDependencies(source.devDependencies),
    optionalDependencies: withoutWorkspaceDependencies(
      source.optionalDependencies,
    ),
    peerDependencies: withoutWorkspaceDependencies(source.peerDependencies),
  };
  const completed = {
    ...packageJson,
    scripts: { ...packageJson.scripts, "exercise:06": "pnpm exercise" },
    devDependencies: {
      ...packageJson.devDependencies,
      tsx: "4.23.9",
      typescript: "5.9.3",
    },
  };
  return {
    contents: JSON.stringify(completed, null, 2),
    dependencies: { ...completed.dependencies, ...completed.devDependencies },
  };
};

const crossOriginHeaders = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

const send = (response, status, headers, body) => {
  response.writeHead(status, { ...crossOriginHeaders, ...headers });
  response.end(body);
};

const startServer = async (state) => {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/") {
        send(
          response,
          200,
          { "Content-Type": "text/html; charset=utf-8" },
          "<!doctype html><html><head></head><body></body></html>",
        );
      } else if (
        request.method === "GET" &&
        url.pathname.startsWith("/webcontainer/")
      ) {
        const relativePath = normalize(
          decodeURIComponent(url.pathname.slice("/webcontainer/".length)),
        );
        const filePath = join(webContainerDistDirectory, relativePath);
        if (!filePath.startsWith(webContainerDistDirectory + sep)) {
          send(response, 403, {}, "Forbidden");
          return;
        }
        const contents = await readFile(filePath);
        send(
          response,
          200,
          {
            "Content-Type": filePath.endsWith(".js")
              ? "text/javascript"
              : "application/octet-stream",
          },
          contents,
        );
      } else if (request.method === "POST" && url.pathname === "/upload") {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        state.uploadedParts.push(Buffer.concat(chunks));
        send(response, 200, { "Content-Type": "text/plain" }, "ok");
      } else if (request.method === "GET" && url.pathname === "/uploaded") {
        if (state.uploadedParts.length === 0) {
          send(response, 404, {}, "Not uploaded");
        } else {
          send(
            response,
            200,
            { "Content-Type": "application/octet-stream" },
            Buffer.concat(state.uploadedParts),
          );
        }
      } else {
        send(response, 404, {}, "Not found");
      }
    } catch (error) {
      send(
        response,
        error?.code === "ENOENT" ? 404 : 500,
        {},
        String(error?.message ?? error),
      );
    }
  });
  await new Promise((resolveListening, rejectListening) => {
    server.once("error", rejectListening);
    server.listen(0, "127.0.0.1", resolveListening);
  });
  return server;
};

const installAndExport = async ({ packageJsonContents, uploadChunkSize }) => {
  const { WebContainer } = await import("/webcontainer/index.js");
  const container = await WebContainer.boot();
  await container.mount({
    workspace: {
      directory: { "package.json": { file: { contents: packageJsonContents } } },
    },
  });

  const installStart = performance.now();
  const install = await container.spawn(
    "npm",
    ["install", "--no-progress", "--no-audit", "--no-fund"],
    { cwd: "workspace", env: { CI: "1" } },
  );
  const installOutput = install.output.pipeTo(
    new WritableStream({ write: (chunk) => console.log(chunk) }),
  );
  const [installExitCode] = await Promise.all([install.exit, installOutput]);
  if (installExitCode !== 0) {
    throw new Error(`npm install failed with exit code ${installExitCode}`);
  }
  const installSeconds = (performance.now() - installStart) / 1000;

  const exportStart = performance.now();
  const exported = await container.export("workspace/node_modules", {
    format: "binary",
  });
  const exportSeconds = (performance.now() - exportStart) / 1000;

  for (let offset = 0; offset < exported.byteLength; offset += uploadChunkSize) {
    const response = await fetch("/upload", {
      method: "POST",
      body: exported.subarray(offset, offset + uploadChunkSize),
    });
    if (!response.ok) throw new Error(`Upload failed with ${response.status}`);
  }

  return { installSeconds, exportSeconds, bytes: exported.byteLength };
};

const mountAndVerify = async () => {
  const { WebContainer } = await import("/webcontainer/index.js");
  const container = await WebContainer.boot();
  await container.fs.mkdir("workspace/node_modules", { recursive: true });

  const response = await fetch("/uploaded");
  if (!response.ok) throw new Error(`Download failed with ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());

  const mountStart = performance.now();
  await container.mount(bytes, { mountPoint: "workspace/node_modules" });
  const mountSeconds = (performance.now() - mountStart) / 1000;

  const check = await container.spawn(
    "node",
    [
      "-e",
      "console.log(require('typescript').version, require('vitest/package.json').version)",
    ],
    { cwd: "workspace" },
  );
  let output = "";
  const checkOutput = check.output.pipeTo(
    new WritableStream({
      write: (chunk) => {
        output += chunk;
      },
    }),
  );
  const [checkExitCode] = await Promise.all([check.exit, checkOutput]);
  console.log(output);
  if (checkExitCode !== 0) {
    throw new Error(`Verification failed with exit code ${checkExitCode}`);
  }
  const typescriptVersion = output.trim().split(/\s+/)[0];
  if (typescriptVersion !== "5.9.3") {
    throw new Error(`Unexpected typescript version: ${typescriptVersion}`);
  }

  return { mountSeconds };
};

const writeSnapshot = async (uploaded, dependencies) => {
  const hash = createHash("sha256").update(uploaded).digest("hex").slice(0, 16);
  const gzipped = gzipSync(uploaded, { level: 9 });
  const snapshotDirectory = join(outputDirectory, "deps-snapshot");
  const partDirectory = join(snapshotDirectory, hash);
  await mkdir(partDirectory, { recursive: true });

  const parts = [];
  for (let offset = 0; offset < gzipped.length; offset += partSize) {
    const name = `part-${String(parts.length).padStart(3, "0")}.bin`;
    await writeFile(
      join(partDirectory, name),
      gzipped.subarray(offset, offset + partSize),
    );
    parts.push(name);
  }

  const manifest = {
    hash,
    rawSize: uploaded.length,
    gzipSize: gzipped.length,
    parts,
    dependencies,
  };
  await writeFile(
    join(snapshotDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
};

const run = async (resources) => {
  const { contents: packageJsonContents, dependencies } =
    await buildPackageJson();

  const state = { uploadedParts: [] };
  resources.server = await startServer(state);
  const { port } = resources.server.address();

  resources.browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });
  const page = await resources.browser.newPage();
  page.on("console", (message) => console.log(`[browser] ${message.text()}`));
  page.on("pageerror", (error) =>
    console.log(`[browser:pageerror] ${error.stack ?? error.message}`),
  );

  await page.goto(`http://localhost:${port}/`);
  const built = await page.evaluate(installAndExport, {
    packageJsonContents,
    uploadChunkSize,
  });
  if (state.uploadedParts.length === 0) throw new Error("Nothing was uploaded");

  await page.reload();
  const verified = await page.evaluate(mountAndVerify);

  const manifest = await writeSnapshot(
    Buffer.concat(state.uploadedParts),
    dependencies,
  );

  console.log(`install seconds: ${built.installSeconds.toFixed(1)}`);
  console.log(`export seconds: ${built.exportSeconds.toFixed(1)}`);
  console.log(`mount seconds: ${verified.mountSeconds.toFixed(1)}`);
  console.log(`rawSize: ${manifest.rawSize}`);
  console.log(`gzipSize: ${manifest.gzipSize}`);
  console.log(`parts: ${manifest.parts.length}`);
  console.log(`hash: ${manifest.hash}`);
};

const main = async () => {
  const resources = { server: undefined, browser: undefined };
  let timer;
  let exitCode = 0;
  try {
    const timeout = new Promise((_, rejectTimeout) => {
      timer = setTimeout(
        () => rejectTimeout(new Error("Timed out after 10 minutes")),
        totalTimeoutMilliseconds,
      );
    });
    await Promise.race([run(resources), timeout]);
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    clearTimeout(timer);
    await resources.browser?.close().catch(() => {});
    if (resources.server !== undefined) {
      resources.server.closeAllConnections();
      await new Promise((resolveClosed) => resources.server.close(resolveClosed));
    }
  }
  process.exit(exitCode);
};

await main();
