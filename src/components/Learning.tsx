import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  RotateCcw,
  Check,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import type { ReviewEvent, Sense, State } from "../lib/model";
import { chooseDiagnostic, matchesAnswer, nextExample } from "../lib/learning";
import { domains } from "../lib/content";
export type StudyMode = "flash" | "context" | "diagnostic" | "collocation";
export interface StudySession {
  items: Sense[];
  mode: StudyMode;
  label: string;
}
export function Learning({
  session,
  state,
  all,
  onReview,
  onFinish,
  onNavigate,
}: {
  session: StudySession;
  state: State;
  all: Sense[];
  onReview: (
    e: ReviewEvent,
    diagnostic?: { id: string; level: number; completed: boolean },
  ) => Promise<boolean>;
  onFinish: () => void;
  onNavigate: () => void;
}) {
  const [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [answer, setAnswer] = useState(""),
    [choice, setChoice] = useState<number | null>(null),
    [checked, setChecked] = useState(false),
    [confidence, setConfidence] = useState(2),
    [busy, setBusy] = useState(false),
    [started, setStarted] = useState(Date.now()),
    [results, setResults] = useState<boolean[]>([]),
    [level, setLevel] = useState(state.diagnosis.level),
    [seen, setSeen] = useState<string[]>(
      state.diagnosis.sampled.length <= all.length - 12
        ? state.diagnosis.sampled
        : [],
    ),
    [last, setLast] = useState<boolean | undefined>();
  const [responseMs, setResponseMs] = useState<number | null>(null),
    [knowledge, setKnowledge] = useState("단어 자체를 모름");
  function reveal(card = false) {
    if (flipped || checked) return;
    setResponseMs(Date.now() - started);
    if (card) setFlipped(true);
    else setChecked(true);
  }
  const diagnostic = session.mode === "diagnostic";
  const sense = useMemo(
    () =>
      diagnostic ? chooseDiagnostic(all, seen, level) : session.items[index],
    [all, diagnostic, index, session.items, seen, level, last],
  );
  const example = useMemo(
    () => (sense ? nextExample(state, sense) : undefined),
    [sense],
  );
  const count = diagnostic ? Math.min(12, all.length) : session.items.length;
  const collocation = session.mode === "collocation";
  const recall = session.mode !== "flash" && !collocation && index % 3 === 0;
  const target = collocation ? sense?.expressions[0] : sense?.meaning;
  const choices = useMemo(() => {
    if (!sense) return [];
    if (collocation) {
      const pool = all
        .filter((s) => s.wordId !== sense.wordId && s.meaning !== sense.meaning)
        .map((s) => s.expressions[0]);
      const out = [
        sense.expressions[0],
        ...[...new Set(pool)].slice(index * 3, index * 3 + 3),
      ];
      const offset = (index + 2) % out.length;
      return [...out.slice(offset), ...out.slice(0, offset)];
    }
    const others = all.filter(
      (s) => s.meaning !== sense.meaning && s.pos === sense.pos,
    );
    const pool =
      others.length >= 3
        ? others
        : all.filter((s) => s.meaning !== sense.meaning);
    const out = [
      sense.meaning,
      ...[...new Set(pool.map((s) => s.meaning))].slice(
        (index * 3) % Math.max(1, pool.length - 3),
        ((index * 3) % Math.max(1, pool.length - 3)) + 3,
      ),
    ];
    const offset = (index + 2) % out.length;
    return [...out.slice(offset), ...out.slice(0, offset)];
  }, [sense, all, index]);
  const correct = recall
    ? matchesAnswer(answer, sense?.aliases ?? [])
    : choice !== null && choices[choice] === target;
  async function submit(
    rating: number,
    kind: ReviewEvent["kind"],
    valid: boolean | null,
  ) {
    if (!sense || !example || busy) return;
    setBusy(true);
    const nextLevel = Math.max(1, Math.min(5, level + (valid ? 1 : -1)));
    const ok = await onReview(
      {
        id: crypto.randomUUID(),
        senseId: sense.id,
        wordId: sense.wordId,
        at: Date.now(),
        kind,
        rating,
        correct: valid,
        confidence,
        responseMs: responseMs ?? Date.now() - started,
        contextId: example.id,
        answer:
          kind === "self" ? undefined : recall ? answer : choices[choice ?? 0],
        errorType:
          valid === false
            ? knowledge
            : valid === true
              ? (responseMs ?? 0) > 10000
                ? "느린 인출"
                : state.events.some(
                      (e) =>
                        e.senseId === sense.id && e.contextId !== example.id,
                    )
                  ? "새 문맥에서 빠른 이해"
                  : "문장 이해 확인"
              : undefined,
      },
      diagnostic
        ? { id: sense.id, level: nextLevel, completed: index + 1 >= count }
        : undefined,
    );
    setBusy(false);
    if (!ok) return;
    setResults((r) => [...r, valid ?? rating >= 2]);
    setSeen((x) => [...x, sense.id]);
    setLevel(nextLevel);
    setLast(valid ?? undefined);
    setIndex((x) => x + 1);
    setFlipped(false);
    setChecked(false);
    setAnswer("");
    setChoice(null);
    setStarted(Date.now());
    setResponseMs(null);
    setKnowledge("단어 자체를 모름");
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        ) ||
        e.repeat ||
        busy
      )
        return;
      if (session.mode === "flash") {
        if (e.code === "Space") {
          e.preventDefault();
          reveal(true);
        }
        if (flipped && /^[1-5]$/.test(e.key)) {
          e.preventDefault();
          void submit(Number(e.key) - 1, "self", null);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipped, busy, sense, index, confidence, started]);
  if (index >= count || !sense || !example)
    return (
      <div className="panel completion">
        <div className="complete-icon">
          <Check size={32} />
        </div>
        <p className="eyebrow">SESSION COMPLETE</p>
        <h2>오늘의 한 걸음을 마쳤어요</h2>
        <p>
          {results.length}개 의미를 학습했습니다.{" "}
          {session.mode === "flash"
            ? "자기 평가는 문맥 테스트에서 다시 확인해 주세요."
            : `확인한 정답 ${results.filter(Boolean).length} / ${results.length}`}
        </p>
        <div className="mini-stats">
          <div>
            <strong>{results.length}</strong>
            <span>학습한 의미</span>
          </div>
          <div>
            <strong>{results.filter((v) => !v).length}</strong>
            <span>다시 확인할 의미</span>
          </div>
        </div>
        <p>
          오답은 10분 뒤, 정확하게 인출한 의미는 최소 1일 뒤 복습합니다. 확신이
          낮으면 복습 간격을 짧게 유지합니다.
        </p>
        <div className="actions">
          <button className="primary" onClick={onFinish}>
            대시보드로
          </button>
          <button onClick={onNavigate}>
            복습 계획 보기 <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  return (
    <div className="study-wrap">
      <div className="study-progress">
        <span>{session.label}</span>
        <strong>
          {index + 1} / {count}
        </strong>
      </div>
      <progress value={index} max={count} />
      <section className="panel flashcard">
        <div className="card-meta">
          <span className="tag">{domains[sense.domain]}</span>
          <span>{sense.pos} · 의미별 학습</span>
          <span className="review-label">언어 검수 필요</span>
        </div>
        <p className="eyebrow">
          {session.mode === "flash"
            ? "RETRIEVE BEFORE YOU REVEAL"
            : recall
              ? "ACTIVE RECALL"
              : "MEANING IN CONTEXT"}
        </p>
        <h2 className="word">{collocation ? "표현 연결" : sense.lemma}</h2>
        <p className="english">{collocation ? sense.meaning : example.en}</p>
        {session.mode === "flash" ? (
          <>
            <p className="muted">문장에서의 뜻을 먼저 떠올려 보세요.</p>
            {!flipped ? (
              <button className="primary" onClick={() => reveal(true)}>
                정답 확인 <kbd>Space</kbd>
              </button>
            ) : (
              <div className="answer">
                <h3>{sense.meaning}</h3>
                <p>{example.ko}</p>
                <div className="tip">
                  <Lightbulb size={18} />
                  <span>{sense.misconception}</span>
                </div>
                <div className="chips">
                  {sense.expressions.map((x) => (
                    <span className="tag" key={x}>
                      {x}
                    </span>
                  ))}
                </div>
                <p className="muted">
                  자기 평가 · 실제 정답률과 별도로 저장됩니다.
                </p>
                <div className="ratings">
                  {[
                    "모름",
                    "틀림",
                    "어려웠지만 맞힘",
                    "정확하게 앎",
                    "즉시 이해함",
                  ].map((label, i) => (
                    <button
                      key={i}
                      disabled={busy}
                      onClick={() => void submit(i, "self", null)}
                    >
                      {i + 1} {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="muted">
              {recall
                ? "해당 단어의 한국어 뜻을 짧게 입력하세요. 자유 번역 채점이 아닌 핵심 뜻 인출입니다."
                : collocation
                  ? "위 의미와 연결되는 자연스러운 연어를 선택하세요."
                  : "이 문장에서 가장 적절한 의미를 선택하세요."}
            </p>
            {recall ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (answer.trim()) reveal();
                }}
              >
                <input
                  aria-label="한국어 뜻"
                  placeholder="기억나는 핵심 뜻"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={checked}
                />
                <button
                  className="primary"
                  disabled={!answer.trim() || checked}
                >
                  답 확인
                </button>
              </form>
            ) : (
              <div className="options">
                {choices.map((c, i) => (
                  <button
                    className={choice === i ? "selected" : ""}
                    key={c}
                    disabled={checked}
                    onClick={() => setChoice(i)}
                  >
                    <span>{String.fromCharCode(65 + i)}</span>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <label className="confidence">
              확신도{" "}
              <select
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                disabled={checked}
              >
                <option value={1}>낮음 · 추측했어요</option>
                <option value={2}>보통 · 생각한 뒤 알았어요</option>
                <option value={3}>높음 · 근거를 이해했어요</option>
              </select>
            </label>
            {!checked && !recall && (
              <button
                className="primary"
                disabled={choice === null}
                onClick={() => reveal()}
              >
                답 확인
              </button>
            )}
            {checked && !correct && (
              <label className="confidence">
                어디에서 막혔나요?
                <select
                  aria-label="이해 단계"
                  value={knowledge}
                  onChange={(e) => setKnowledge(e.target.value)}
                >
                  {[
                    "단어 자체를 모름",
                    "단어는 알지만 해당 의미를 모름",
                    "뜻은 알지만 문장에서 이해하지 못함",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            )}
            {checked && (
              <div className={"answer " + (correct ? "correct" : "incorrect")}>
                <h3>
                  {correct ? "정확해요." : "이 의미를 다시 확인해 보세요."}
                </h3>
                <strong>
                  {collocation ? sense.expressions[0] : sense.meaning}
                </strong>
                {collocation && <p className="english small">{example.en}</p>}
                <p>{example.ko}</p>
                <div className="tip">
                  <Lightbulb size={18} />
                  {sense.misconception}
                </div>
                {recall && !correct && (
                  <p className="muted">
                    허용 답과 표현이 다르면 오답으로 확인될 수 있습니다. 뜻이
                    같았다면 자기 평가로 기록하세요. 이 기록은 검증된 정답에
                    포함되지 않습니다.
                  </p>
                )}
                <div className="actions">
                  <button
                    disabled={busy}
                    className="primary"
                    onClick={() =>
                      void submit(
                        correct ? 3 : 0,
                        recall
                          ? "recall"
                          : collocation
                            ? "collocation"
                            : diagnostic
                              ? "diagnostic"
                              : "choice",
                        correct,
                      )
                    }
                  >
                    기록하고 다음 <ArrowRight size={16} />
                  </button>
                  {recall && !correct && (
                    <button
                      disabled={busy}
                      onClick={() => void submit(3, "self", null)}
                    >
                      같은 뜻이었어요 · 자기 평가
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>
      <div className="study-footer">
        <BookOpen size={16} />
        <span>같은 단어도 의미마다 복습 일정이 다릅니다.</span>
        <button onClick={onFinish}>
          <RotateCcw size={14} />
          학습 종료
        </button>
      </div>
    </div>
  );
}
