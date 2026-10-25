import { openDB } from "idb";
import {
  backupSchema,
  contentSchema,
  emptyState,
  type State,
  type ContentData,
} from "./model";
const db = () =>
  openDB("rc-vocabulary-lab", 1, {
    upgrade(db) {
      db.createObjectStore("state");
    },
  });
export async function loadState(): Promise<State> {
  const d = await db();
  try {
    const raw = await d.get("state", "current");
    return raw ? backupSchema.parse(raw) : emptyState();
  } finally {
    d.close();
  }
}
export async function saveState(s: State): Promise<void> {
  const valid = backupSchema.parse(s);
  const d = await db();
  try {
    const tx = d.transaction("state", "readwrite");
    await tx.store.put(valid, "current");
    await tx.done;
  } finally {
    d.close();
  }
}
export async function restoreBackup(raw: string): Promise<State> {
  if (raw.length > 50000000) throw new Error("백업은 50MB 이하만 지원합니다.");
  const s = backupSchema.parse(JSON.parse(raw));
  const d = await db();
  try {
    const tx = d.transaction("state", "readwrite");
    const old = await tx.store.get("current");
    if (old) await tx.store.put(old, "before-restore");
    await tx.store.put(s, "current");
    await tx.done;
    return s;
  } finally {
    d.close();
  }
}
export function download(
  name: string,
  data: string,
  type = "application/json",
) {
  const u = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}
export function csv(s: State) {
  const rows = [
    [
      "senseId",
      "kind",
      "correct",
      "rating",
      "confidence",
      "responseMs",
      "at",
      "contextId",
    ],
    ...s.events.map((e) => [
      e.senseId,
      e.kind,
      e.correct,
      e.rating,
      e.confidence,
      e.responseMs,
      new Date(e.at).toISOString(),
      e.contextId,
    ]),
  ];
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r.map((x) => '"' + String(x ?? "").replace(/"/g, '""') + '"').join(","),
      )
      .join("\n")
  );
}
// Read-modify-write within one IndexedDB transaction prevents stale-tab overwrites.
export async function updateStoredState(
  fn: (state: State) => State,
): Promise<State> {
  const d = await db();
  try {
    const tx = d.transaction("state", "readwrite");
    const raw = await tx.store.get("current");
    const next = backupSchema.parse(
      fn(raw ? backupSchema.parse(raw) : emptyState()),
    );
    await tx.store.put(next, "current");
    await tx.done;
    return next;
  } finally {
    d.close();
  }
}
export async function loadVocabulary() {
  const d = await db();
  try {
    const raw = await d.get("state", "vocabulary");
    return raw ? contentSchema.parse(raw) : null;
  } finally {
    d.close();
  }
}
export async function saveVocabulary(content: ContentData) {
  const valid = contentSchema.parse(content);
  const d = await db();
  try {
    const tx = d.transaction("state", "readwrite");
    const state = await tx.store.get("current");
    const ids = new Set(valid.senses.map((s) => s.id));
    if (
      state &&
      Object.keys(backupSchema.parse(state).cards).some((id) => !ids.has(id))
    ) {
      tx.abort();
      throw Error("학습 기록이 참조하는 의미를 제거할 수 없습니다.");
    }
    await tx.store.put(valid, "vocabulary");
    await tx.done;
  } finally {
    d.close();
  }
}
