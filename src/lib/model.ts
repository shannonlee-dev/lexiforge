import { z } from "zod";
export interface Example {
  id: string;
  en: string;
  ko: string;
}
export interface Sense {
  id: string;
  wordId: string;
  lemma: string;
  pos: string;
  meaning: string;
  aliases: string[];
  domain: string;
  difficulty: number;
  priority: number;
  examples: Example[];
  expressions: string[];
  prepositions: string[];
  confusion: string[];
  family: string[];
  misconception: string;
  reviewStatus: "needs-review" | "reviewed";
  source: string;
  cefr: null | string;
}
export interface Candidate {
  id: string;
  lemma: string;
  sources: string[];
  status: string;
}
const finite = z.number().finite().nonnegative();
const eventSchema = z.object({
  id: z.string().min(1),
  senseId: z.string().min(1),
  wordId: z.string().min(1),
  at: finite,
  kind: z.enum(["self", "choice", "recall", "diagnostic", "collocation"]),
  rating: z.number().int().min(0).max(4),
  correct: z.boolean().nullable(),
  confidence: z.number().int().min(1).max(3),
  responseMs: finite,
  contextId: z.string(),
  answer: z.string().max(10000).optional(),
  errorType: z.string().optional(),
});
export type ReviewEvent = z.infer<typeof eventSchema>;
const cardSchema = z.object({
  wordId: z.string(),
  due: finite,
  last: finite,
  interval: finite,
  ease: z.number().finite().min(1.3).max(3),
  repetitions: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
});
export type Card = z.infer<typeof cardSchema>;
const readingSchema = z
  .object({
    id: z.string(),
    itemId: z.string(),
    at: finite,
    kind: z.enum(["sentence", "passage"]),
    correct: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    seconds: finite,
    words: z.number().int().nonnegative(),
    confidence: z.number().int().min(1).max(3),
    errorType: z.string(),
    answer: z.string(),
    selfAssessed: z.boolean(),
  })
  .refine((r) => r.correct <= r.total);
export type ReadingResult = z.infer<typeof readingSchema>;
export const backupSchema = z
  .object({
    version: z.literal(1),
    cards: z.record(z.string(), cardSchema),
    events: z.array(eventSchema).max(200000),
    reading: z.array(readingSchema).max(100000),
    settings: z.object({
      dailyNew: z.number().int().min(1).max(100),
      dark: z.boolean(),
      timed: z.boolean(),
    }),
    diagnosis: z.object({
      completed: z.boolean(),
      sampled: z.array(z.string()),
      level: z.number().min(1).max(5),
    }),
    notes: z.record(z.string(), z.string().max(5000)),
  })
  .superRefine((s, ctx) => {
    const ids = new Set<string>();
    const eventTimes = new Set(s.events.map((e) => e.senseId + ":" + e.at));
    for (const e of s.events) {
      if (
        ids.has(e.id) ||
        !s.cards[e.senseId] ||
        s.cards[e.senseId].wordId !== e.wordId
      )
        ctx.addIssue({
          code: "custom",
          message: "중복 기록 또는 잘못된 의미 참조",
        });
      ids.add(e.id);
      if ((e.kind === "self") !== (e.correct === null))
        ctx.addIssue({ code: "custom", message: "평가 유형 불일치" });
    }
    for (const [key, c] of Object.entries(s.cards)) {
      if (!eventTimes.has(key + ":" + c.last))
        ctx.addIssue({ code: "custom", message: "일정과 기록 불일치" });
    }
  });
export type State = z.infer<typeof backupSchema>;
export function emptyState(): State {
  return {
    version: 1,
    cards: {},
    events: [],
    reading: [],
    settings: { dailyNew: 15, dark: false, timed: false },
    diagnosis: { completed: false, sampled: [], level: 3 },
    notes: {},
  };
}
const text = z.string().min(1).max(10000);
export const senseSchema = z.object({
  id: text,
  wordId: text,
  lemma: text,
  pos: z.enum(["n", "v", "adj", "adv", "prep", "phrase"]),
  meaning: text,
  aliases: z.array(text).min(1),
  domain: z.enum([
    "contract",
    "finance",
    "banking",
    "hr",
    "office",
    "logistics",
    "procurement",
    "production",
    "sales",
    "service",
    "travel",
    "hotel",
    "facility",
    "it",
    "education",
    "health",
    "news",
    "general",
  ]),
  difficulty: z.number().int().min(1).max(5),
  priority: z.number().int().min(1).max(5),
  examples: z
    .array(z.object({ id: text, en: text, ko: text }))
    .min(1)
    .max(30),
  expressions: z.array(text),
  prepositions: z.array(text),
  confusion: z.array(text),
  family: z.array(text),
  misconception: text,
  reviewStatus: z.enum(["needs-review", "reviewed"]),
  source: text,
  cefr: z.string().nullable(),
});
export const contentSchema = z
  .object({
    senses: z.array(senseSchema).min(1).max(50000),
    candidates: z
      .array(
        z.object({
          id: text,
          lemma: text,
          sources: z.array(text),
          status: z.enum(["candidate", "learning"]),
        }),
      )
      .max(50000),
  })
  .superRefine((v, ctx) => {
    const ids = new Set<string>(),
      candidateIds = new Set<string>();
    for (const c of v.candidates) {
      if (candidateIds.has(c.id))
        ctx.addIssue({ code: "custom", message: "중복 표제어 ID" });
      candidateIds.add(c.id);
    }
    for (const s of v.senses) {
      if (ids.has(s.id) || !candidateIds.has(s.wordId))
        ctx.addIssue({
          code: "custom",
          message: "중복 의미 또는 없는 표제어 참조",
        });
      ids.add(s.id);
      if (new Set(s.examples.map((e) => e.id)).size !== s.examples.length)
        ctx.addIssue({ code: "custom", message: "중복 예문 ID" });
    }
  });
export type ContentData = z.infer<typeof contentSchema>;
