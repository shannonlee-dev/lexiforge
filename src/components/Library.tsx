import { useMemo, useState } from "react";
import { Search, ArrowRight, BookOpen } from "lucide-react";
import type { Sense, Candidate, State } from "../lib/model";
import { domains } from "../lib/content";
import { isMastered } from "../lib/learning";
export function Library({
  all,
  candidates,
  state,
  onStudy,
  onNote,
}: {
  all: Sense[];
  candidates: Candidate[];
  state: State;
  onStudy: (s: Sense[]) => void;
  onNote: (id: string, text: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState(""),
    [domain, setDomain] = useState(""),
    [showCandidates, setShowCandidates] = useState(false),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [note, setNote] = useState(""),
    [saved, setSaved] = useState(false);
  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase().trim();
    return all.filter(
      (s) =>
        (!domain || s.domain === domain) &&
        [s.lemma, s.meaning, ...s.expressions].some((x) =>
          x.toLowerCase().includes(q),
        ),
    );
  }, [all, query, domain]);
  const words = useMemo(
    () => [...new Set(filtered.map((s) => s.wordId))],
    [filtered],
  );
  const other = useMemo(
    () =>
      candidates.filter(
        (c) =>
          c.status === "candidate" &&
          c.lemma.includes(query.toLowerCase().trim()),
      ),
    [candidates, query],
  );
  const total = showCandidates ? other.length : words.length;
  function search(q: string) {
    setQuery(q);
    setPage(0);
    setSelected(null);
  }
  return (
    <>
      <div className="panel search-panel">
        <div className="search-field">
          <Search size={20} />
          <input
            placeholder="단어, 뜻, 표현을 검색하세요"
            value={query}
            onChange={(e) => search(e.target.value)}
          />
        </div>
        <select
          aria-label="분야 필터"
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            setPage(0);
          }}
          disabled={showCandidates}
        >
          <option value="">모든 분야</option>
          {Object.entries(domains).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="section-heading">
        <div className="segmented">
          <button
            className={!showCandidates ? "active" : ""}
            onClick={() => {
              setShowCandidates(false);
              setPage(0);
            }}
          >
            학습 가능한 어휘
          </button>
          <button
            className={showCandidates ? "active" : ""}
            onClick={() => {
              setShowCandidates(true);
              setPage(0);
            }}
          >
            확장 후보 목록
          </button>
        </div>
        <span className="muted">{total.toLocaleString()}개 표제어</span>
      </div>
      {showCandidates ? (
        <>
          <p className="notice">
            후보에는 아직 한국어 뜻과 예문이 없습니다. 학습 및 숙달 수에
            포함되지 않습니다. NGSL·TSL·BSL 출처 · CC BY-SA 4.0.
          </p>
          <div className="panel candidate-grid">
            {other.slice(page * 30, page * 30 + 30).map((c) => (
              <div key={c.id}>
                <strong>{c.lemma}</strong>
                <span>{c.sources.join(" · ").toUpperCase()}</span>
                <small>의미 작성 대기</small>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="word-list">
          {words.slice(page * 15, page * 15 + 15).map((w) => {
            const senses = filtered.filter((s) => s.wordId === w);
            return (
              <section className="panel word-entry" key={w}>
                <div className="entry-heading">
                  <h3>{senses[0].lemma}</h3>
                  <span className="tag">{domains[senses[0].domain]}</span>
                  <span className="muted">{senses.length}개 의미</span>
                </div>
                {senses.map((s) => (
                  <div className="sense-row" key={s.id}>
                    <div>
                      <span className="pos">{s.pos}</span>
                      <strong>{s.meaning}</strong>
                      <small>{s.expressions.join(" · ")}</small>
                      <span className="muted">
                        {isMastered(state, s.id)
                          ? "새 문맥 숙달 기준 충족"
                          : state.cards[s.id]
                            ? "학습 중"
                            : "미학습"}{" "}
                        · 언어 검수 필요
                      </span>
                    </div>
                    <div className="actions">
                      <button
                        onClick={() => {
                          setSelected(selected === s.id ? null : s.id);
                          setNote(state.notes[s.id] ?? "");
                          setSaved(false);
                        }}
                      >
                        상세 보기
                      </button>
                      <button
                        className="text-button"
                        onClick={() => onStudy([s])}
                      >
                        이 의미 학습 <ArrowRight size={15} />
                      </button>
                    </div>
                    {selected === s.id && (
                      <div className="sense-detail">
                        {s.examples.map((e) => (
                          <div key={e.id}>
                            <p className="english small">{e.en}</p>
                            <p>{e.ko}</p>
                          </div>
                        ))}
                        <div className="tip">{s.misconception}</div>
                        {s.confusion.length > 0 && (
                          <p>비교할 단어: {s.confusion.join(" / ")}</p>
                        )}
                        {s.prepositions.length > 0 && (
                          <p>결합: {s.prepositions.join(" / ")}</p>
                        )}
                        {s.family.length > 0 && (
                          <p>관련어: {s.family.join(" / ")}</p>
                        )}
                        <label className="field">
                          나의 메모
                          <textarea
                            value={note}
                            onChange={(e) => {
                              setNote(e.target.value);
                              setSaved(false);
                            }}
                            maxLength={5000}
                          />
                        </label>
                        <button
                          onClick={async () => {
                            if (await onNote(s.id, note)) setSaved(true);
                          }}
                        >
                          {saved ? "저장했어요" : "메모 저장"}
                        </button>
                        <small>
                          의미 ID: {s.id} · 예문 출처: 자체 작성 · CEFR 미지정
                        </small>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {total === 0 && (
        <div className="empty">
          <BookOpen />
          <h3>검색 결과가 없습니다</h3>
          <p>다른 단어나 확장 후보 목록을 확인해 보세요.</p>
        </div>
      )}
      <div className="pagination">
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          이전
        </button>
        <span>
          {page + 1} /{" "}
          {Math.max(1, Math.ceil(total / (showCandidates ? 30 : 15)))}
        </span>
        <button
          disabled={(page + 1) * (showCandidates ? 30 : 15) >= total}
          onClick={() => setPage(page + 1)}
        >
          다음
        </button>
      </div>
    </>
  );
}
