import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { setTimeout } from "node:timers";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import process from "node:process";
import console from "node:console";
import { loadEnv } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const modeIndex = process.argv.indexOf("--mode");
const mode = modeIndex < 0 ? "development" : process.argv[modeIndex + 1];
const env = { ...loadEnv(mode, root, ""), ...process.env };
const port = Number(env.MARINECAST_API_PORT || env.MARINECAST_RELATIONSHIPS_PORT || 8001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("MARINECAST_API_PORT must be a port from 1 to 65535.");
const url = `http://127.0.0.1:${port}/api/local-data/health`;
const children = new Set();
const completions = [];
let stopping = false;

function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  // Allow reader cleanup to finish before forcing an unresponsive child to exit.
  setTimeout(() => { for (const child of children) child.kill("SIGKILL"); }, 10_000).unref();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

function start(command, args) {
  const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
  children.add(child);
  const completion = once(child, "exit").then(([code]) => {
    children.delete(child);
    return code ?? (stopping ? 0 : 1);
  }).catch(error => {
    children.delete(child);
    throw error;
  });
  // Store a handled completion immediately, including early spawn failures.
  completions.push(completion.catch(() => {}));
  return { child, completion };
}

async function health() {
  try {
    const response = await globalThis.fetch(url, { signal: globalThis.AbortSignal.timeout(1000) });
    const value = response.ok ? await response.json() : null;
    if (value?.service === "marinecast-data-explorer" && value.version === 1 && value.status === "ready") return true;
    throw new Error(`Port ${port} is occupied by another service. Stop it or set MARINECAST_API_PORT.`);
  } catch (error) {
    if (error.message.startsWith("Port ")) throw error;
    return false;
  }
}

try {
  let backend;
  if (await health()) {
    console.log(`Using the running Data Explorer API on port ${port}.`);
  } else {
    const python = env.MARINECAST_DATA_PYTHON || env.METEOROLOGY_PYTHON || "python3";
    backend = start(python, [resolve(root, "scripts/data_api.py")]);
    let exited = false;
    let failure;
    void backend.completion.then(() => { exited = true; }, error => { exited = true; failure = error; });
    let ready = false;
    for (let attempt = 0; attempt < 150 && !stopping; attempt++) {
      if (exited) throw failure || new Error("The API stopped. Set MARINECAST_DATA_PYTHON to Python with requirements-relationships.txt installed.");
      if (await health()) { ready = true; break; }
      await delay(200);
    }
    if (!ready && !stopping) throw new Error("The local API did not become ready within 30 seconds.");
  }
  if (!stopping && process.argv[2] === "dev") {
    const frontend = start(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", ...process.argv.slice(3)]);
    // A backend failure must close the owned frontend too.
    if (backend) void backend.completion.then(code => { if (!stopping) { process.exitCode = code || 1; stop(); } });
    const code = await frontend.completion;
    if (!stopping) process.exitCode = code;
    stop();
  } else if (!stopping && backend) {
    const code = await backend.completion;
    if (!stopping) process.exitCode = code;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
  stop();
} finally {
  await Promise.all(completions);
}
