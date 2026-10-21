import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";

/** Local, read-only Parquet queries. No network acquisition or full-file browser transfer. */
export function meteorologyData(python = "python3", source = resolve("../../Data/Meteorology")): Plugin {
  let child: ChildProcessWithoutNullStreams | undefined;
  let sequence = 0;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const fail = () => {
    child = undefined;
    for (const request of pending.values()) request.reject(new Error("Local meteorology reader unavailable. Prepare the data and check METEOROLOGY_PYTHON."));
    pending.clear();
  };
  const query = (parameters: Record<string, string>) => new Promise<unknown>((resolveResult, reject) => {
    if (pending.size >= 8) { reject(new Error("Meteorology reader is busy. Try again.")); return; }
    if (!child) {
      child = spawn(python, [resolve("scripts/meteorology_data.py"), "--source", source], { stdio: ["pipe", "pipe", "pipe"] });
      child.on("error", fail);
      child.on("exit", fail);
      // Python diagnostics remain local; never mix them into the JSON protocol.
      child.stderr.on("data", () => {});
      createInterface({ input: child.stdout }).on("line", line => {
        try {
          const message = JSON.parse(line) as { id: number; error?: string; result?: unknown };
          const request = pending.get(message.id);
          pending.delete(message.id);
          if (message.error) request?.reject(new Error(message.error));
          else request?.resolve(message.result);
        } catch { fail(); }
      });
    }
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error("Meteorology read timed out. Try again.")); }, 20_000);
    pending.set(id, { resolve: result => { clearTimeout(timeout); resolveResult(result); }, reject: error => { clearTimeout(timeout); reject(error); } });
    child.stdin.write(JSON.stringify({ ...parameters, id }) + "\n");
  });
  const install = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use("/api/meteorology", (request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.setHeader("Cache-Control", "no-store");
      const url = new URL(request.url ?? "/", "http://localhost");
      const operation = url.searchParams.get("operation");
      if (request.method !== "GET" || !["daily", "hourly"].includes(operation ?? "")) {
        response.statusCode = 400;
        response.end(JSON.stringify({ error: "Unsupported read-only meteorology query." }));
        return;
      }
      const parameters = Object.fromEntries(["operation", "snapshot", "metric", "date", "cell", "period"].flatMap(key => {
        const value = url.searchParams.get(key);
        return value ? [[key, value]] : [];
      }));
      void query(parameters).then(result => response.end(JSON.stringify(result))).catch((error: Error) => {
        response.statusCode = 503;
        response.end(JSON.stringify({ error: error.message }));
      });
    });
    server.httpServer?.once("close", () => { child?.kill(); });
  };
  return { name: "local-meteorology-data", configureServer: install, configurePreviewServer: install };
}
