import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import "fake-indexeddb/auto";
import { template } from "../src/lib/project";
import { loadWorkspace, saveWorkspace } from "../src/lib/storage";
import {
  renderHTML,
  resolveLocal,
  previewWindowHTML,
} from "../src/lib/preview";
test("IndexedDB preserves multiple projects, edits and empty files", async () => {
  const p = template("html");
  p.files["main.js"] = "";
  p.files["index.html"] = "edited";
  const q = template("php");
  await saveWorkspace({ version: 1, activeId: q.id, projects: [p, q] });
  const restored = await loadWorkspace();
  assert.equal(restored?.activeId, q.id);
  assert.equal(restored.projects[0].files["main.js"], "");
  assert.equal(restored.projects[0].files["index.html"], "edited");
});
test("HTML preview uses edited sources, inlines CSS/assets and executes JavaScript", async () => {
  const parser = new JSDOM("").window.DOMParser;
  globalThis.DOMParser = parser;
  const p = template("html");
  p.files["index.html"] =
    '<html><head><link rel="stylesheet" href="style.css"></head><body><h1 id="result">Before</h1><img src="image.svg"><script src="main.js"></script></body></html>';
  p.files["main.js"] =
    'document.querySelector("#result").textContent="Source executed";';
  p.files["image.svg"] = '<svg xmlns="http://www.w3.org/2000/svg"/>';
  const html = renderHTML(p);
  assert.ok(!html.includes('src="main.js"'));
  assert.match(html, /data:image\/svg/);
  assert.match(html, /Content-Security-Policy/);
  const dom = new JSDOM(html, { runScripts: "dangerously" });
  assert.equal(
    dom.window.document.querySelector("h1")?.textContent,
    "Source executed",
  );
  assert.ok(
    dom.window.document.querySelector("style")?.textContent?.includes(":root"),
  );
  assert.match(previewWindowHTML(html), /sandbox="allow-scripts"/);
  dom.window.close();
});
test("relative assets and missing local dependencies produce predictable errors", () => {
  assert.equal(resolveLocal("pages/index.html", "../style.css"), "style.css");
  assert.equal(resolveLocal("index.html", "https://example.com/a.js"), null);
  const p = template("html");
  p.files["index.html"] = '<script src="missing.js"></script>';
  assert.throws(() => renderHTML(p), /Missing script/);
});

test("standalone JavaScript entry in a subfolder resolves from project root", () => {
  const p = template("js");
  p.entry = "src/main.js";
  p.files[p.entry] =
    'document.querySelector("#app").textContent="Nested JS ran";';
  const html = renderHTML(p);
  const dom = new JSDOM(html, { runScripts: "dangerously" });
  assert.equal(
    dom.window.document.querySelector("#app")?.textContent,
    "Nested JS ran",
  );
  dom.window.close();
});
