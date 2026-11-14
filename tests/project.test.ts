import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  template,
  validateProject,
  replaceFile,
  safePath,
} from "../src/lib/project";
import { exportZip, importProject } from "../src/lib/archive";
import {
  localSuggestions,
  parseChanges,
  visibleReply,
  missingPackages,
  motionCheck,
} from "../src/lib/suggestions";
test("templates are valid, including an executable Next.js project", () => {
  for (const mode of ["html", "js", "nextjs", "php"] as const) {
    const p = validateProject(template(mode));
    assert.ok(p.files[p.entry]);
  }
  assert.match(template("nextjs").files["package.json"], /next dev/);
});
test("reject traversal, secret and prototype paths", () => {
  for (const path of [
    "../outside",
    "/etc/passwd",
    "x/../../bad",
    "x\\bad",
    ".env.local",
    "x/node_modules/pkg",
    "__proto__",
    "constructor",
  ])
    assert.throws(() => safePath(path));
});
test("archive round trip preserves text, binary, empty folder, entry and runtime", async () => {
  const original = {
    ...template("php"),
    folders: ["includes"],
    assets: { "image.png": "iVBORw0KGgo=" },
  };
  const blob = await exportZip(original);
  const file = new File([await blob.arrayBuffer()], "demo.zip");
  const restored = await importProject(file);
  assert.deepEqual({ ...restored.files }, { ...original.files });
  assert.deepEqual({ ...restored.assets }, { ...original.assets });
  assert.equal(restored.mode, "php");
  assert.equal(restored.entry, "index.php");
  assert.ok(restored.folders.includes("includes"));
});
test("import strips generated files and secrets and supports wrapped folders", async () => {
  const zip = new JSZip();
  zip.file("demo/index.html", "<h1>Hello</h1>");
  zip.file("demo/.env", "SECRET");
  zip.file("demo/node_modules/a.js", "generated");
  const p = await importProject(
    new File([await zip.generateAsync({ type: "arraybuffer" })], "demo.zip"),
  );
  assert.deepEqual(Object.keys(p.files), ["index.html"]);
});
test("traversal zip and huge declared files are refused", async () => {
  const zip = new JSZip();
  zip.file("../bad.html", "bad");
  await assert.rejects(
    importProject(
      new File([await zip.generateAsync({ type: "arraybuffer" })], "bad.zip"),
    ),
    /Unsafe archive path/,
  );
  const huge = new JSZip();
  huge.file("big.txt", "a".repeat(13 * 1024 * 1024));
  await assert.rejects(
    importProject(
      new File(
        [
          await huge.generateAsync({
            type: "arraybuffer",
            compression: "DEFLATE",
          }),
        ],
        "huge.zip",
      ),
    ),
    /exceeds/,
  );
});
test("empty content remains empty and stale AI patches cannot overwrite edits", () => {
  const p = template("html");
  const next = replaceFile(p, "main.js", p.files["main.js"], "");
  assert.equal(next.files["main.js"], "");
  assert.throws(
    () => replaceFile(next, "main.js", p.files["main.js"], "overwrite"),
    /changed/,
  );
});
test("local checks actually patch files", () => {
  const p = template("html");
  const s = localSuggestions(p, "index.html")[0];
  assert.match(s.after, /name="viewport"/);
  assert.equal(
    localSuggestions(replaceFile(p, s.path, s.before, s.after), "index.html")
      .length,
    0,
  );
});
test("AI change blocks are parsed, bounded and checked against shown files", () => {
  const files = { "main.js": "a" };
  const existing = new Set(["main.js", "secret.js"]);
  const block = (v: unknown) =>
    "Here is the fix.\n<studio-changes>" + JSON.stringify(v) + "</studio-changes>";
  const ok = parseChanges(
    block([
      { path: "main.js", title: "t", description: "d", content: "b" },
      { path: "new/util.js", title: "n", description: "d", content: "x" },
    ]),
    files,
    existing,
  );
  assert.equal(ok[0].before, "a");
  assert.equal(ok[0].after, "b");
  assert.equal(ok[1].isNew, true);
  assert.equal(visibleReply(block([])), "Here is the fix.");
  assert.deepEqual(parseChanges("No changes needed.", files, existing), []);
  assert.throws(() =>
    parseChanges(block([{ path: "secret.js", title: "t", description: "d", content: "z" }]), files, existing),
  );
  assert.throws(() =>
    parseChanges(block([{ path: "../x", title: "t", description: "d", content: "z" }]), files, existing),
  );
  assert.throws(() =>
    parseChanges(block([{ path: "main.js", title: "t", description: "d", content: "a" }]), files, existing),
  );
  assert.throws(() => parseChanges("x <studio-changes>[", files, existing), /cut off/);
});
test("review helpers flag new packages and unguarded motion", () => {
  const p = template("nextjs");
  assert.deepEqual(
    missingPackages(p, "app/page.tsx", 'import { motion } from "motion/react";\nimport { useState } from "react";\nimport x from "./x";'),
    ["motion"],
  );
  assert.equal(motionCheck("a{}", "a{transition: opacity .2s}"), "warn");
  assert.equal(
    motionCheck("a{}", "a{transition: opacity .2s} @media (prefers-reduced-motion: reduce){a{transition:none}}"),
    "ok",
  );
  assert.equal(motionCheck("a{}", "b{}"), "none");
});
