import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createReadStream } from "node:fs";
import { cp, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createInterface } from "node:readline";
import type { ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";

type Options = { python?: string; data?: string; weather?: string; pilot?: string; components?: string };
type Reply = { json?: unknown; file?: string };
/** Serve validated current files. Each independent reader owns its process and temporary encodings. */
export function localData(options: Options = {}): Plugin {
  const workers = new Map<string, { query: (parameters: Record<string, string>) => Promise<unknown>; close: () => void }>();
  const clients = new Set<ServerResponse>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let polling = false;
  let previous = "";
  let buildDirectory = "";
  let building = false;
  const worker = (domain: string) => {
    const known = workers.get(domain);
    if (known) return known;
    let child: ChildProcessWithoutNullStreams | undefined;
    let sequence = 0;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
    const fail = () => {
      child = undefined;
      for (const request of pending.values()) request.reject(new Error("The local data reader stopped. Check the configured Python environment and retry."));
      pending.clear();
    };
    const query = (parameters: Record<string, string>) => new Promise<unknown>((resolveResult, reject) => {
      if (pending.size >= 32) { reject(new Error("Local data reader is busy. Try again.")); return; }
      if (!child) {
        const args = [resolve("scripts/local_data.py"), "--data", options.data ?? resolve("../../Data"),
          "--public", resolve("public/local-data"), "--study", resolve("../../config/study.v1.json")];
        for (const key of ["weather", "pilot", "components"] as const) if (options[key]) args.push(`--${key}`, options[key]);
        child = spawn(options.python ?? "python3", args, { stdio: ["pipe", "pipe", "pipe"] });
        child.on("error", fail);
        child.on("exit", fail);
        child.stderr.on("data", () => {});
        createInterface({ input: child.stdout }).on("line", line => {
          try {
            const message = JSON.parse(line) as { id: number; error?: string; result?: unknown };
            const request = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) request?.reject(new Error(message.error));
            else request?.resolve(message.result);
          } catch { child?.kill(); fail(); }
        });
      }
      const id = ++sequence;
      // A changed multi-year weather product needs validation, independently of map startup.
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error("Current files are still being validated. Retry shortly.")); }, 600_000);
      pending.set(id, { resolve: value => { clearTimeout(timeout); resolveResult(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
      child.stdin.write(JSON.stringify({ ...parameters, id }) + "\n");
    });
    const instance = { query, close: () => { child?.stdin.end(); child?.kill(); fail(); } };
    workers.set(domain, instance);
    return instance;
  };
  const install = (server: ViteDevServer | PreviewServer) => {
    const poll = async () => {
      if (polling || !clients.size) return;
      polling = true;
      try {
        const versions = JSON.stringify(await worker("watch").query({ operation: "versions" }));
        if (versions !== previous) {
          previous = versions;
          for (const client of clients) client.write(`event: sources\ndata: ${versions}\n\n`);
        }
      } catch { /* An unavailable worker will retry; read requests expose specific errors. */ }
      finally { polling = false; }
    };
    if ("watcher" in server) {
      server.watcher.add(resolve("scripts"));
      server.watcher.on("change", path => {
        if (!path.startsWith(resolve("scripts") + "/") || !path.endsWith(".py") || basename(path).startsWith("test_")) return;
        for (const reader of workers.values()) reader.close();
        workers.clear();
        previous = "";
        void poll();
      });
    }
    timer = setInterval(() => { void poll(); }, 2_000);
    timer.unref();
    server.middlewares.use((request, response, next) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const path = url.pathname;
      if (path === "/api/local-data/events") {
        if (request.method !== "GET") { response.writeHead(405).end(); return; }
        response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
        response.write("retry: 2000\n\n");
        clients.add(response);
        if (previous) response.write(`event: sources\ndata: ${previous}\n\n`);
        request.on("close", () => clients.delete(response));
        void poll();
        return;
      }
      const domain = path.split("/")[2];
      const asset = path.startsWith("/local-data/");
      const weather = path === "/api/meteorology";
      if (!asset && !weather) { next(); return; }
      response.setHeader("Content-Type", "application/json");
      response.setHeader("Cache-Control", "no-store");
      if (!["GET", "HEAD"].includes(request.method ?? "") || (asset && !["seascape", "orca", "hydrology", "river-influence", "meteorology", "viewshed"].includes(domain))) {
        response.writeHead(400).end(JSON.stringify({ error: "Unsupported read-only local data request." }));
        return;
      }
      const parameters = weather ? Object.fromEntries(["operation", "snapshot", "metric", "date", "cell", "period"].flatMap(key => {
        const value = url.searchParams.get(key); return value ? [[key, value]] : [];
      })) : { path };
      if (weather && !["daily", "hourly"].includes(parameters.operation ?? "")) {
        response.writeHead(400).end(JSON.stringify({ error: "Unsupported weather query." })); return;
      }
      void worker(weather ? "meteorology" : domain).query(parameters).then(value => {
        if (response.destroyed) return;
        if (weather) { response.end(request.method === "HEAD" ? undefined : JSON.stringify(value)); return; }
        const result = value as Reply;
        if (request.method === "HEAD") { response.end(); return; }
        if (result.file) {
          const stream = createReadStream(result.file);
          stream.on("error", () => { if (!response.headersSent) response.statusCode = 503; response.end(); });
          stream.pipe(response);
        } else response.end(JSON.stringify(result.json));
      }).catch((error: Error) => {
        if (response.destroyed) return;
        response.statusCode = 503;
        response.end(JSON.stringify({ error: error.message }));
      });
    });
    server.httpServer?.once("close", () => {
      if (timer) clearInterval(timer);
      for (const client of clients) client.end();
      clients.clear();
      for (const reader of workers.values()) reader.close();
    });
  };
  return {
    name: "current-local-data",
    configureServer: install,
    configurePreviewServer: install,
    // A preview runs the same local reader; never duplicate scientific snapshots into dist.
    config: () => ({ build: { copyPublicDir: false } }),
    configResolved: config => { buildDirectory = resolve(config.root, config.build.outDir); building = config.command === "build"; },
    async closeBundle() {
      if (!building || !buildDirectory) return;
      for (const entry of await readdir(resolve("public"), { withFileTypes: true })) {
        if (entry.name !== "local-data") await cp(resolve("public", entry.name), resolve(buildDirectory, entry.name), { recursive: true });
      }
    },
  };
}
