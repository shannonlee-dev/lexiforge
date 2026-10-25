import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock, BookOpen } from "lucide-react";
import { sentences, passages, errors } from "../lib/content";
import type { ReadingResult, State } from "../lib/model";
export function Reading({
  kind,
  state,
  onSave,
  onStudy,
}: {
  kind: "sentence" | "passage";
  state: State;
  onSave: (r: ReadingResult) => Promise<boolean>;
  onStudy: (lemmas: string[]) => void;
}) {
  const [selected, setSelected] = useState(0),
    [answer, setAnswer] = useState(""),
    [revealed, setRevealed] = useState(false),
    [checks, setChecks] = useState<number[]>([]),
    [choices, setChoices] = useState<Record<number, number>>({}),
    [confidence, setConfidence] = useState(2),
    [error, setError] = useState(errors[0]),
    [started, setStarted] = useState(Date.now()),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const items = kind === "sentence" ? sentences : passages;
  const s = sentences[selected % sentences.length],
    p = passages[selected % passages.length];
  function reset(i: number) {
    setSelected(i);
    setAnswer("");
    setRevealed(false);
    setChecks([]);
    setChoices({});
    setSaved(false);
    setElapsed(0);
    setStarted(Date.now());
  }
  useEffect(() => {
    reset(0);
  }, [kind]);
  useEffect(() => {
    if (revealed) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [started, revealed]);
  async function save() {
    setBusy(true);
    const sentence = kind === "sentence";
    const ok = await onSave({
      id: crypto.randomUUID(),
      itemId: sentence ? s.id : p.id,
      at: Date.now(),
      kind,
      correct: sentence
        ? checks.length
        : p.questions.filter((q, i) => choices[i] === q.answer).length,
      total: sentence ? s.checks.length : p.questions.length,
      seconds: Math.max(1, elapsed),
      words: (sentence ? s.en : p.documents.map((d) => d.text).join(" ")).split(
        /\s+/,
      ).length,
      confidence,
      errorType: error,
      answer: sentence ? answer : JSON.stringify(choices),
      selfAssessed: sentence,
    });
    setBusy(false);
    if (ok) setSaved(true);
  }
  return (
    <div className="reading-layout">
      <aside className="panel reading-list">
        <p className="eyebrow">
          {kind === "sentence" ? "CLOSE READING" : "READ & CONNECT"}
        </p>
        {items.map((item, i) => (
          <button
            key={item.id}
            className={selected === i ? "active" : ""}
            onClick={() => reset(i)}
          >
            <span className="index">{String(i + 1).padStart(2, "0")}</span>
            <span>
              {"title" in item
                ? item.title
                : item.vocab.slice(0, 2).join(" · ")}
              <small>{"type" in item ? item.type : "문장 정밀해석"}</small>
            </span>
          </button>
        ))}
      </aside>
      <div>
        <div className="reading-toolbar">
          <span className="tag">직접 작성한 학습 자료 · 검수 필요</span>
          <span>
            <Clock size={14} />
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
            {state.settings.timed ? " / 목표 3:00" : " · 정확도 우선"}
          </span>
        </div>
        {state.settings.timed && elapsed > 180 && !revealed && (
          <p className="notice">
            목표 시간이 지났습니다. 풀이를 마친 뒤 정확도와 시간을 함께
            확인하세요.
          </p>
        )}
        {kind === "sentence" ? (
          <section className="panel reading-paper">
            <p className="eyebrow">SENTENCE {selected + 1}</p>
            <p className="english">{s.en}</p>
            <label className="field">
              나의 해석
              <textarea
                placeholder="원문의 의미를 한국어로 설명해 보세요."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={revealed}
              />
            </label>
            {!revealed ? (
              <button
                className="primary"
                disabled={!answer.trim()}
                onClick={() => setRevealed(true)}
              >
                해설과 비교하기 <ArrowRight size={16} />
              </button>
            ) : (
              <div className="answer">
                <h3>전체 해석</h3>
                <p>{s.ko}</p>
                <h3>의미 단위로 읽기</h3>
                {s.chunks.map(([en, ko]) => (
                  <div className="chunk" key={en}>
                    <strong>{en}</strong>
                    <span>{ko}</span>
                  </div>
                ))}
                <h3>문장 구조</h3>
                <p>{s.structure}</p>
                <div className="tip">{s.pitfall}</div>
                <h3>직접 확인한 의미</h3>
                <p className="muted">
                  자동 채점하지 않습니다. 표현이 달라도 의미를 전달했다면
                  체크하세요.
                </p>
                {s.checks.map((text, i) => (
                  <label className="check-row" key={i}>
                    <input
                      type="checkbox"
                      checked={checks.includes(i)}
                      disabled={saved}
                      onChange={(e) =>
                        setChecks(
                          e.target.checked
                            ? [...checks, i]
                            : checks.filter((x) => x !== i),
                        )
                      }
                    />
                    {text}
                  </label>
                ))}
                <button onClick={() => onStudy(s.vocab)}>
                  <BookOpen size={16} />
                  핵심 어휘 복습
                </button>
              </div>
            )}
          </section>
        ) : (
          <>
            <div className="documents">
              {p.documents.map((d, i) => (
                <article className="panel reading-paper" key={i}>
                  <p className="eyebrow">
                    DOCUMENT {i + 1} / {p.documents.length}
                  </p>
                  <h3>{d.title}</h3>
                  <p className="passage-text">{d.text}</p>
                </article>
              ))}
            </div>
            <section className="panel questions">
              <h3>근거를 연결해 보세요</h3>
              {p.questions.map((q, i) => (
                <div className="question" key={i}>
                  <h4>
                    {i + 1}. {q.prompt}
                  </h4>
                  <div className="options">
                    {q.options.map((o, j) => (
                      <button
                        key={j}
                        className={choices[i] === j ? "selected" : ""}
                        disabled={revealed}
                        onClick={() => setChoices({ ...choices, [i]: j })}
                      >
                        <span>{String.fromCharCode(65 + j)}</span>
                        {o}
                      </button>
                    ))}
                  </div>
                  {revealed && (
                    <div
                      className={
                        "feedback " +
                        (choices[i] === q.answer ? "correct" : "incorrect")
                      }
                    >
                      <strong>
                        {choices[i] === q.answer ? "정답" : "다시 확인"} ·{" "}
                        {q.options[q.answer]}
                      </strong>
                      <p>{q.evidence}</p>
                    </div>
                  )}
                </div>
              ))}
              {!revealed && (
                <button
                  className="primary"
                  disabled={Object.keys(choices).length < p.questions.length}
                  onClick={() => setRevealed(true)}
                >
                  정답과 근거 확인
                </button>
              )}
            </section>
          </>
        )}
        {revealed && (
          <section className="panel result-panel">
            <label className="field">
              확신도
              <select
                value={confidence}
                disabled={saved}
                onChange={(e) => setConfidence(Number(e.target.value))}
              >
                <option value={1}>낮음 · 답을 추측했어요</option>
                <option value={2}>보통</option>
                <option value={3}>높음 · 근거를 이해했어요</option>
              </select>
            </label>
            <label className="field">
              다음에 점검할 부분
              <select
                value={error}
                disabled={saved}
                onChange={(e) => setError(e.target.value)}
              >
                {errors.map((x) => (
                  <option key={x}>{x}</option>
                ))}
                <option>없음 · 모두 이해함</option>
              </select>
            </label>
            <button
              className="primary"
              disabled={busy || saved}
              onClick={() => void save()}
            >
              {saved ? (
                <>
                  <Check size={16} />
                  기록 저장 완료
                </>
              ) : (
                "학습 결과 기록"
              )}
            </button>
            {saved && (
              <button onClick={() => reset((selected + 1) % items.length)}>
                다음 학습 <ArrowRight size={16} />
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
