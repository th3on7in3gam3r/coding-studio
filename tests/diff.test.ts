import test from "node:test";
import assert from "node:assert/strict";
import { applyHunks, diffLines, diffStats, hunks } from "../src/lib/diff";

const before = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join("\n");
const after = before
  .replace("line 2\n", "line 2\nadded near top\n")
  .replace("line 25", "line 25 changed");

test("diff finds the exact added and changed lines", () => {
  const lines = diffLines(before, after);
  assert.equal(lines.filter((l) => l.type === "add").length, 2);
  assert.equal(lines.filter((l) => l.type === "del").length, 1);
  assert.deepEqual(diffStats(before, after), { added: 2, removed: 1 });
  assert.deepEqual(diffLines("same", "same").map((l) => l.type), ["same"]);
});

test("separate changes become separate hunks with context", () => {
  const h = hunks(before, after);
  assert.equal(h.length, 2);
  assert.ok(h[0].lines.some((l) => l.text === "added near top"));
  assert.ok(h[1].lines.some((l) => l.text === "line 25 changed"));
  assert.ok(h[0].lines.length <= 7);
});

test("each hunk can be kept or skipped independently", () => {
  assert.equal(applyHunks(before, after, [0, 1]), after);
  assert.equal(applyHunks(before, after, []), before);
  const onlyFirst = applyHunks(before, after, [0]);
  assert.match(onlyFirst, /added near top/);
  assert.doesNotMatch(onlyFirst, /line 25 changed/);
  const onlySecond = applyHunks(before, after, [1]);
  assert.doesNotMatch(onlySecond, /added near top/);
  assert.match(onlySecond, /line 25 changed/);
});

test("new files and trailing newlines diff cleanly", () => {
  assert.deepEqual(diffStats("", "a\nb"), { added: 2, removed: 0 });
  assert.equal(applyHunks("a\n", "a\nb\n", [0]), "a\nb\n");
});
