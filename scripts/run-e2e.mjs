import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const node = process.execPath;
const vite = resolve("node_modules/vite/bin/vite.js");

for (const [command, args] of [
  [resolve("node_modules/typescript/bin/tsc"), ["-b"]],
  [vite, ["build"]],
]) {
  const result = spawnSync(node, [command, ...args], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const preview = spawn(
  node,
  [vite, "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
  { stdio: "inherit" },
);

async function waitForPreview() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4173");
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error("Timed out waiting for the production preview server.");
}

function stopPreview() {
  if (!preview.killed) preview.kill();
}

process.once("SIGINT", stopPreview);
process.once("SIGTERM", stopPreview);

try {
  await waitForPreview();
  const tests = spawn(
    node,
    [
      resolve("node_modules/playwright/cli.js"),
      "test",
      ...process.argv.slice(2),
    ],
    { stdio: "inherit" },
  );
  const status = await new Promise((resolveStatus) => {
    tests.once("exit", (code) => resolveStatus(code ?? 1));
  });
  stopPreview();
  process.exit(status);
} catch (error) {
  stopPreview();
  console.error(error);
  process.exit(1);
}
