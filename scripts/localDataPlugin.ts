import { cp, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/** Copy public artwork without duplicating local scientific products into a build. */
export function localAssets(): Plugin {
  let root = "";
  let buildDirectory = "";
  let building = false;
  return {
    name: "local-public-assets",
    config: () => ({ build: { copyPublicDir: false } }),
    configResolved: config => {
      root = config.root;
      buildDirectory = resolve(root, config.build.outDir);
      building = config.command === "build";
    },
    async closeBundle() {
      if (!building) return;
      for (const entry of await readdir(resolve(root, "public"), { withFileTypes: true })) {
        if (entry.name !== "local-data") await cp(resolve(root, "public", entry.name), resolve(buildDirectory, entry.name), { recursive: true });
      }
    },
  };
}
