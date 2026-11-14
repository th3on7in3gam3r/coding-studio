import test from "node:test";
import assert from "node:assert/strict";
import { blankProject, validateProject, type Mode } from "../src/lib/project";
import { importFolder, skipImportPath } from "../src/lib/archive";

test("blank projects are empty, valid and named by the user", () => {
  for (const mode of ["html", "js", "php", "nextjs"] as Mode[]) {
    const p = blankProject(mode, "Church <landing> page");
    assert.equal(p.name, "Church <landing> page");
    assert.equal(p.mode, mode);
    assert.ok(p.entry in p.files, `${mode} entry exists`);
    assert.doesNotThrow(() => validateProject(p));
    assert.doesNotMatch(Object.values(p.files).join("\n"), /YOUR NEXT IDEA|Clicked 0 times/);
  }
  assert.match(blankProject("html", "Church <landing> page").files["index.html"], /<title>Church landing page<\/title>/);
  assert.equal(blankProject("html", "   ").name, "Untitled project");
  assert.equal(JSON.parse(blankProject("nextjs", "My Shop").files["package.json"]).name, "my-shop");
});

function fileAt(path: string, content: string | Uint8Array<ArrayBuffer>) {
  const f = new File([content], path.split("/").pop()!);
  Object.defineProperty(f, "webkitRelativePath", { value: path });
  return f;
}

test("uploading a folder builds a project and skips secrets and dependencies", async () => {
  const p = await importFolder([
    fileAt("my-site/index.html", "<h1>Hi</h1>"),
    fileAt("my-site/css/site.css", "h1{color:red}"),
    fileAt("my-site/img/logo.png", new Uint8Array([137, 80, 78, 71, 0, 1, 2])),
    fileAt("my-site/.env", "SECRET=1"),
    fileAt("my-site/node_modules/x/index.js", "module.exports=1"),
    fileAt("my-site/.git/config", "[core]"),
  ]);
  assert.equal(p.name, "my-site");
  assert.equal(p.mode, "html");
  assert.equal(p.entry, "index.html");
  assert.deepEqual(Object.keys(p.files).sort(), ["css/site.css", "index.html"]);
  assert.deepEqual(Object.keys(p.assets), ["img/logo.png"]);
  assert.ok(p.folders.includes("css") && p.folders.includes("img"));
});

test("folder upload detects PHP and Next.js projects", async () => {
  const php = await importFolder([fileAt("blog/index.php", "<?php echo 1;"), fileAt("blog/inc/db.php", "<?php")]);
  assert.equal(php.mode, "php");
  assert.equal(php.entry, "index.php");
  const next = await importFolder([
    fileAt("shop/package.json", '{"dependencies":{"next":"16"}}'),
    fileAt("shop/src/app/page.tsx", "export default function P(){return null}"),
  ]);
  assert.equal(next.mode, "nextjs");
  assert.equal(next.entry, "src/app/page.tsx");
  await assert.rejects(importFolder([fileAt("x/.env", "A=1")]), /No code files/);
  assert.equal(skipImportPath("a/.env.local"), true);
  assert.equal(skipImportPath("src/environment.ts"), false);
});
