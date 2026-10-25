import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { emptyState, backupSchema } from "../src/lib/model";
import {
  recordReview,
  isMastered,
  stats,
  chooseDiagnostic,
  matchesAnswer,
} from "../src/lib/learning";
import { saveState, loadState, restoreBackup } from "../src/lib/storage";
const now = Date.UTC(2026, 9, 25);
const event = (overrides = {}) => ({
  id: crypto.randomUUID(),
  senseId: "quote-price",
  wordId: "quote",
  at: now,
  kind: "self" as const,
  rating: 4,
  correct: null,
  confidence: 3,
  responseMs: 1500,
  contextId: "a",
  ...overrides,
});
describe("learning invariants", () => {
  it("self report never establishes mastery", () => {
    let s = emptyState();
    for (let i = 0; i < 8; i++)
      s = recordReview(s, event({ at: now + i * 86400000 }));
    expect(isMastered(s, "quote-price")).toBe(false);
    expect(stats(s).tested).toBe(0);
  });
  it("failure schedules a short relearning interval and resets success streak", () => {
    const s = recordReview(
      emptyState(),
      event({ kind: "choice", correct: false, rating: 0 }),
    );
    expect(s.cards["quote-price"].due).toBe(now + 600000);
    expect(s.cards["quote-price"].lapses).toBe(1);
  });
  it("keeps senses independent and counts headwords once", () => {
    let s = recordReview(emptyState(), event());
    s = recordReview(s, event({ senseId: "quote-cite" }));
    expect(Object.keys(s.cards)).toHaveLength(2);
    expect(stats(s).words).toBe(1);
  });
  it("requires spaced transfer and recall, and revokes mastery after failure", () => {
    let s = emptyState();
    for (let i = 0; i < 4; i++)
      s = recordReview(
        s,
        event({
          kind: i === 0 ? "recall" : "choice",
          correct: true,
          contextId: String(i),
          at: now + i * 86400000,
        }),
      );
    expect(isMastered(s, "quote-price")).toBe(true);
    s = recordReview(
      s,
      event({ kind: "choice", correct: false, at: now + 5 * 86400000 }),
    );
    expect(isMastered(s, "quote-price")).toBe(false);
  });
  it("same context and quick guesses do not establish mastery", () => {
    let s = emptyState();
    for (let i = 0; i < 4; i++)
      s = recordReview(
        s,
        event({ kind: "choice", correct: true, at: now + i * 86400000 }),
      );
    expect(isMastered(s, "quote-price")).toBe(false);
  });
  it("low confidence correct answer stays due soon", () => {
    let s = emptyState();
    for (let i = 0; i < 5; i++)
      s = recordReview(
        s,
        event({ kind: "choice", correct: true, at: now + i * 86400000 }),
      );
    s = recordReview(
      s,
      event({
        kind: "choice",
        correct: true,
        confidence: 1,
        at: now + 6 * 86400000,
      }),
    );
    expect(s.cards["quote-price"].interval).toBeLessThanOrEqual(1);
  });
  it("deduplicates event retries", () => {
    const e = event();
    let s = recordReview(emptyState(), e);
    s = recordReview(s, e);
    expect(s.events).toHaveLength(1);
  });
  it("accepts explicit aliases without pretending to grade free translation", () => {
    expect(matchesAnswer(" 잠정적인 ", ["잠정적인", "임시의"])).toBe(true);
    expect(matchesAnswer("확정적인", ["잠정적인"])).toBe(false);
  });
  it("diagnosis adjusts difficulty and avoids sampled senses", () => {
    const items = [
      { id: "a", difficulty: 1, domain: "x" },
      { id: "b", difficulty: 3, domain: "y" },
      { id: "c", difficulty: 4, domain: "z" },
    ];
    expect(chooseDiagnostic(items, [], 2, true)?.id).toBe("b");
    expect(chooseDiagnostic(items, ["b"], 3, true)?.id).toBe("c");
  });
});
describe("durable data", () => {
  it("survives reload and rejects invalid restore atomically", async () => {
    const s = recordReview(emptyState(), event());
    await saveState(s);
    expect((await loadState()).events).toHaveLength(1);
    await expect(restoreBackup('{"version":99}')).rejects.toThrow();
    expect((await loadState()).events).toHaveLength(1);
  });
  it("roundtrips JSON and rejects invalid references, dates and duplicate ids", async () => {
    const s = recordReview(emptyState(), event());
    await restoreBackup(JSON.stringify(s));
    expect((await loadState()).cards).toEqual(s.cards);
    expect(
      backupSchema.safeParse({
        ...s,
        cards: { "quote-price": { ...s.cards["quote-price"], due: -1 } },
      }).success,
    ).toBe(false);
    expect(
      backupSchema.safeParse({ ...s, events: [s.events[0], s.events[0]] })
        .success,
    ).toBe(false);
  });
});

import { updateStoredState } from "../src/lib/storage";
import { contextQueue, readingNeedsReview } from "../src/lib/learning";
it("transactional updates preserve reviews across stale tabs", async () => {
  await saveState(emptyState());
  await updateStoredState((s) => recordReview(s, event()));
  await updateStoredState((s) => ({
    ...s,
    settings: { ...s.settings, dark: true },
  }));
  const saved = await loadState();
  expect(saved.events).toHaveLength(1);
  expect(saved.settings.dark).toBe(true);
});
it("context practice rotates through unverified meanings", () => {
  const senses = Array.from(
    { length: 30 },
    (_, i) =>
      ({
        id: "s" + i,
        wordId: "w" + i,
        lemma: "word" + i,
        priority: 3,
        difficulty: 3,
        examples: [
          {
            id: "ctx" + i,
            en: "A sample sentence for learning.",
            ko: "학습 예문입니다.",
          },
        ],
      }) as any,
  );
  let s = emptyState();
  for (const sense of senses.slice(0, 12))
    s = recordReview(
      s,
      event({
        senseId: sense.id,
        wordId: sense.wordId,
        kind: "choice",
        correct: true,
      }),
    );
  expect(
    contextQueue(s, senses, now)
      .slice(0, 12)
      .map((x) => x.id),
  ).toEqual(senses.slice(12, 24).map((x) => x.id));
});
it("correct answers with wrong evidence remain in reading review", () => {
  expect(
    readingNeedsReview({
      correct: 2,
      total: 2,
      confidence: 2,
      errorType: "논리적 추론 오류",
    } as any),
  ).toBe(true);
  expect(
    readingNeedsReview({
      correct: 2,
      total: 2,
      confidence: 3,
      errorType: "없음 · 모두 이해함",
    } as any),
  ).toBe(false);
});
import { contentSchema } from "../src/lib/model";
import { saveVocabulary, loadVocabulary } from "../src/lib/storage";
import vocab from "../public/vocabulary.json";
import candidates from "../public/candidates.json";
it("vocabulary export restores and rejects duplicate sense ids", async () => {
  const content = contentSchema.parse({ senses: vocab, candidates });
  await saveVocabulary(content);
  expect((await loadVocabulary())?.senses.length).toBe(vocab.length);
  expect(
    contentSchema.safeParse({ senses: [vocab[0], vocab[0]], candidates })
      .success,
  ).toBe(false);
});
it("counts phrases separately from headwords", () => {
  let s = recordReview(
    emptyState(),
    event({ senseId: "carry-forward-transfer", wordId: "carry-forward" }),
  );
  expect(
    stats(s, now, [{ id: "carry-forward-transfer", pos: "phrase" } as any])
      .words,
  ).toBe(0);
});
it("validates a 6000-word import without dropping entries", () => {
  const senses = Array.from({ length: 6000 }, (_, i) => ({
    ...vocab[0],
    id: "sense-" + i,
    wordId: "word-" + i,
    lemma: "word " + i,
  }));
  const candidates = senses.map((s) => ({
    id: s.wordId,
    lemma: s.lemma,
    status: "learning",
    sources: ["test"],
  }));
  const before = performance.now();
  const parsed = contentSchema.parse({ senses, candidates });
  expect(parsed.senses).toHaveLength(6000);
  expect(performance.now() - before).toBeLessThan(5000);
});
import { collocationAccuracy } from "../src/lib/learning";
it("collocation accuracy is measured separately from card self reports", () => {
  let s = recordReview(emptyState(), event());
  expect(collocationAccuracy(s)).toBeNull();
  s = recordReview(s, event({ kind: "collocation", correct: true }));
  expect(backupSchema.safeParse(s).success).toBe(true);
  expect(collocationAccuracy(s)).toBe(100);
});
