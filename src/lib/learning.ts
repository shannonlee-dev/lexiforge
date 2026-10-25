import type { State, ReviewEvent, Sense } from "./model";
const DAY = 86400000;
export function recordReview(state: State, event: ReviewEvent): State {
  if (state.events.some((e) => e.id === event.id)) return state;
  const old = state.cards[event.senseId] ?? {
    wordId: event.wordId,
    due: event.at,
    last: event.at,
    interval: 0,
    ease: 2.5,
    repetitions: 0,
    lapses: 0,
  };
  const passed =
    event.kind === "self" ? event.rating >= 2 : event.correct === true;
  const quality = passed ? Math.min(5, event.rating + 1) : 1;
  const ease = Math.min(
    3,
    Math.max(
      1.3,
      old.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
    ),
  );
  let interval = passed
    ? old.repetitions === 0
      ? 1
      : old.repetitions === 1
        ? 6
        : Math.max(1, Math.round(old.interval * ease))
    : 10 / 1440;
  if (event.confidence === 1 && passed) interval = Math.min(interval, 1);
  // Self-ratings may maintain a schedule, but cannot provide verified mastery evidence.
  if (event.kind === "self") interval = Math.min(interval, 7);
  const card = {
    ...old,
    ease,
    interval,
    due: event.at + Math.round(interval * DAY),
    last: event.at,
    repetitions: passed ? old.repetitions + 1 : 0,
    lapses: old.lapses + (passed ? 0 : 1),
  };
  return {
    ...state,
    cards: { ...state.cards, [event.senseId]: card },
    events: [...state.events, event],
  };
}
export function isMastered(s: State, id: string): boolean {
  const all = s.events
    .filter((e) => e.senseId === id)
    .sort((a, b) => a.at - b.at);
  let lastFail = -1;
  all.forEach((e, i) => {
    if (e.correct === false || (e.kind === "self" && e.rating < 2))
      lastFail = i;
  });
  const ev = all
    .slice(lastFail + 1)
    .filter(
      (e) =>
        e.correct === true &&
        e.confidence >= 2 &&
        e.kind !== "self" &&
        e.kind !== "collocation",
    );
  return (
    ev.length >= 3 &&
    new Set(ev.map((e) => e.contextId)).size >= 2 &&
    ev.some((e) => e.kind === "recall") &&
    new Set(ev.map((e) => new Date(e.at).toDateString())).size >= 3 &&
    ev.at(-1)!.at - ev[0].at >= 3 * DAY
  );
}
export function stats(s: State, now = Date.now(), senses?: Sense[]) {
  const ev = s.events.filter((e) => e.correct !== null);
  const today = new Date(now).toDateString();
  const todays = s.events.filter(
    (e) => new Date(e.at).toDateString() === today,
  );
  const first = new Map<string, number>();
  s.events.forEach((e) => {
    if (!first.has(e.senseId)) first.set(e.senseId, e.at);
  });
  return {
    words: new Set(
      Object.entries(s.cards)
        .filter(
          ([id]) =>
            !senses || senses.some((x) => x.id === id && x.pos !== "phrase"),
        )
        .map(([, c]) => c.wordId),
    ).size,
    senses: Object.keys(s.cards).length,
    mastered: Object.keys(s.cards).filter((id) => isMastered(s, id)).length,
    tested: new Set(ev.map((e) => e.senseId)).size,
    due: Object.values(s.cards).filter((c) => c.due <= now).length,
    today: todays.length,
    newToday: [...first.values()].filter(
      (t) => new Date(t).toDateString() === today,
    ).length,
    reviewsToday: todays.filter((e) => first.get(e.senseId) !== e.at).length,
    accuracy: ev.length
      ? Math.round((100 * ev.filter((e) => e.correct).length) / ev.length)
      : null,
  };
}
export function chooseDiagnostic<
  T extends { id: string; difficulty: number; domain: string },
>(
  items: T[],
  seen: string[],
  level: number,
  lastCorrect?: boolean,
): T | undefined {
  const target = Math.max(
    1,
    Math.min(5, level + (lastCorrect === undefined ? 0 : lastCorrect ? 1 : -1)),
  );
  const domains = new Set(
    items.filter((i) => seen.includes(i.id)).map((i) => i.domain),
  );
  return items
    .filter((i) => !seen.includes(i.id))
    .sort(
      (a, b) =>
        Math.abs(a.difficulty - target) +
        (domains.has(a.domain) ? 0.4 : 0) -
        (Math.abs(b.difficulty - target) + (domains.has(b.domain) ? 0.4 : 0)),
    )[0];
}
export function matchesAnswer(answer: string, aliases: string[]): boolean {
  const normalize = (v: string) =>
    v
      .trim()
      .toLowerCase()
      .replace(/[\s.,!?]/g, "");
  return aliases.some((a) => normalize(a) === normalize(answer));
}
export function queue(
  s: State,
  senses: Sense[],
  mode: "today" | "review" | "errors" | "all" = "today",
  now = Date.now(),
): Sense[] {
  const due = senses
    .filter((x) => s.cards[x.id]?.due <= now)
    .sort((a, b) => s.cards[a.id].due - s.cards[b.id].due);
  if (mode === "review") return due;
  if (mode === "errors")
    return senses
      .filter((x) =>
        s.events.some(
          (e) =>
            e.senseId === x.id &&
            (e.correct === false ||
              e.confidence === 1 ||
              (e.kind === "self" && e.rating < 2)),
        ),
      )
      .sort((a, b) => (s.cards[a.id]?.due ?? 0) - (s.cards[b.id]?.due ?? 0));
  const priority = new Set(["tentative", "prospective", "retain"]);
  const fresh = senses
    .filter((x) => !s.cards[x.id])
    .sort(
      (a, b) =>
        Number(priority.has(b.lemma)) - Number(priority.has(a.lemma)) ||
        b.priority - a.priority,
    );
  return mode === "all"
    ? [...due, ...fresh]
    : [
        ...due,
        ...fresh.slice(
          0,
          Math.max(0, s.settings.dailyNew - stats(s, now).newToday),
        ),
      ];
}
export function nextExample(s: State, sense: Sense) {
  const seen = s.events
    .filter((e) => e.senseId === sense.id)
    .map((e) => e.contextId);
  return (
    sense.examples.find((e) => !seen.includes(e.id)) ??
    sense.examples[seen.length % sense.examples.length]
  );
}
export function contextQueue(
  s: State,
  senses: Sense[],
  now = Date.now(),
): Sense[] {
  const tests = new Map<string, number>();
  for (const e of s.events)
    if (e.correct !== null)
      tests.set(e.senseId, (tests.get(e.senseId) ?? 0) + 1);
  return [...senses].sort((a, b) => {
    const rank = (x: Sense) =>
      s.cards[x.id]?.due <= now ? 0 : !tests.has(x.id) ? 1 : 2;
    return (
      rank(a) - rank(b) ||
      (tests.get(a.id) ?? 0) - (tests.get(b.id) ?? 0) ||
      (s.cards[a.id]?.last ?? 0) - (s.cards[b.id]?.last ?? 0) ||
      b.priority - a.priority
    );
  });
}
export function readingNeedsReview(r: {
  correct: number;
  total: number;
  confidence: number;
  errorType: string;
}) {
  return (
    r.correct < r.total ||
    r.confidence === 1 ||
    r.errorType !== "없음 · 모두 이해함"
  );
}

export function collocationAccuracy(s: State) {
  const rows = s.events.filter((e) => e.kind === "collocation");
  return rows.length
    ? Math.round((rows.filter((e) => e.correct).length / rows.length) * 100)
    : null;
}
