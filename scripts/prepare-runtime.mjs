import { mkdir, readFile, writeFile, copyFile, cp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
const require = createRequire(import.meta.url);
await mkdir("public/runtime", { recursive: true });
const pkg = dirname(require.resolve("@php-wasm/web-8-3/package.json"));
const loader = join(pkg, "asyncify/php_8_3.js");
const source = await readFile(loader, "utf8");
const match = source.match(/import dependencyFilename from '([^']+)';/);
if (!match)
  throw new Error("PHP runtime layout changed; update prepare-runtime");
await copyFile(join(dirname(loader), match[1]), "public/runtime/php.wasm");
await writeFile(
  "public/runtime/php-loader.js",
  source.replace(match[0], "const dependencyFilename = '/runtime/php.wasm';"),
);
await copyFile(join(pkg, "LICENSE"), "public/runtime/PHP-LICENSE");
await build({
  entryPoints: ["scripts/php-worker.ts"],
  outfile: "public/runtime/php-worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ["./php-loader.js", "worker_threads"],
  minify: true,
});
await rm("public/monaco", { recursive: true, force: true });
await cp(dirname(require.resolve("monaco-editor")), "public/monaco/vs", {
  recursive: true,
});
console.log("Prepared self-hosted PHP WASM worker and Monaco assets.");
