/**
 * Line diff with reviewable hunks. Each hunk can be kept or skipped
 * independently; `applyHunks` rebuilds the file from the choices.
 */
export type DiffLine = {
  type: "same" | "add" | "del";
  text: string;
  /** 1-based line number in the old file (same/del). */
  oldNo?: number;
  /** 1-based line number in the new file (same/add). */
  newNo?: number;
};
export type Hunk = {
  id: number;
  oldStart: number;
  oldEnd: number;
  added: number;
  removed: number;
  lines: DiffLine[];
};

const MAX_CELLS = 25_000_000;

function split(text: string) {
  return text === "" ? [] : text.split("\n");
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = split(before),
    b = split(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start])
    start++;
  let endA = a.length,
    endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA),
    midB = b.slice(start, endB);
  const n = midA.length,
    m = midB.length;
  const middle: DiffLine[] = [];
  if ((n + 1) * (m + 1) > MAX_CELLS) {
    // Very large rewrite: show as one replacement instead of exhausting memory.
    for (const text of midA) middle.push({ type: "del", text });
    for (const text of midB) middle.push({ type: "add", text });
  } else {
    // Longest common subsequence table, filled from the end.
    const w = m + 1;
    const lcs = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        lcs[i * w + j] =
          midA[i] === midB[j]
            ? lcs[(i + 1) * w + j + 1] + 1
            : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    let i = 0,
      j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        middle.push({ type: "same", text: midA[i] });
        i++;
        j++;
      } else if (j < m && (i >= n || lcs[i * w + j + 1] >= lcs[(i + 1) * w + j])) {
        middle.push({ type: "add", text: midB[j++] });
      } else {
        middle.push({ type: "del", text: midA[i++] });
      }
    }
  }
  const all: DiffLine[] = [
    ...a.slice(0, start).map((text) => ({ type: "same" as const, text })),
    ...middle,
    ...a.slice(endA).map((text) => ({ type: "same" as const, text })),
  ];
  let oldNo = 0,
    newNo = 0;
  for (const line of all) {
    if (line.type !== "add") line.oldNo = ++oldNo;
    if (line.type !== "del") line.newNo = ++newNo;
  }
  return all;
}

/** Group changed lines into hunks with `context` unchanged lines around them. */
export function hunks(before: string, after: string, context = 3): Hunk[] {
  return hunksFrom(diffLines(before, after), context);
}
function hunksFrom(lines: DiffLine[], context: number): Hunk[] {
  const changed = lines
    .map((l, i) => (l.type === "same" ? -1 : i))
    .filter((i) => i >= 0);
  const result: Hunk[] = [];
  let k = 0;
  while (k < changed.length) {
    let last = changed[k];
    let next = k + 1;
    while (next < changed.length && changed[next] - last <= context * 2 + 1)
      last = changed[next++];
    const from = Math.max(0, changed[k] - context),
      to = Math.min(lines.length, last + context + 1);
    const slice = lines.slice(from, to);
    const olds = slice.filter((l) => l.oldNo).map((l) => l.oldNo!);
    result.push({
      id: result.length,
      oldStart: olds[0] ?? 0,
      oldEnd: olds[olds.length - 1] ?? 0,
      added: slice.filter((l) => l.type === "add").length,
      removed: slice.filter((l) => l.type === "del").length,
      lines: slice,
    });
    k = next;
  }
  return result;
}

/** Rebuild the file, keeping only the hunks whose ids are in `keep`. */
export function applyHunks(
  before: string,
  after: string,
  keep: Iterable<number>,
  context = 3,
): string {
  const kept = new Set(keep);
  const lines = diffLines(before, after);
  const all = hunksFrom(lines, context);
  if (all.every((h) => kept.has(h.id))) return after;
  if (!all.some((h) => kept.has(h.id))) return before;
  // Map each changed line index to its hunk id (hunks are built in order).
  const owner = new Map<number, number>();
  let cursor = 0;
  for (const h of all) {
    for (const line of h.lines) {
      while (lines[cursor] !== line) cursor++;
      if (line.type !== "same") owner.set(cursor, h.id);
    }
  }
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (line.type === "same") out.push(line.text);
    else if (kept.has(owner.get(i)!)) {
      if (line.type === "add") out.push(line.text);
    } else if (line.type === "del") out.push(line.text);
  });
  return out.join("\n");
}

export function diffStats(before: string, after: string) {
  let added = 0,
    removed = 0;
  for (const l of diffLines(before, after)) {
    if (l.type === "add") added++;
    if (l.type === "del") removed++;
  }
  return { added, removed };
}
