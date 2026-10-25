import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  LayoutDashboard,
  Compass,
  Layers,
  RotateCcw,
  ScanText,
  FileText,
  NotebookPen,
  ChartNoAxesCombined,
  Search,
  Settings,
  Sun,
  Moon,
  ChevronRight,
  Target,
  Sparkles,
  Check,
  Clock,
  Download,
  Upload,
  ShieldCheck,
  WifiOff,
  Menu,
  X,
  Leaf,
} from "lucide-react";
import type {
  Candidate,
  Sense,
  State,
  ReviewEvent,
  ReadingResult,
} from "./lib/model";
import { backupSchema, contentSchema, emptyState } from "./lib/model";
import {
  loadState,
  loadVocabulary,
  saveVocabulary,
  saveState,
  updateStoredState,
  restoreBackup,
  download,
  csv,
} from "./lib/storage";
import {
  stats,
  recordReview,
  queue,
  isMastered,
  contextQueue,
  readingNeedsReview,
  collocationAccuracy,
} from "./lib/learning";
import { domains, passages, sentences } from "./lib/content";
import { Learning, type StudySession } from "./components/Learning";
import { Reading } from "./components/Reading";
import { Library } from "./components/Library";
type Page =
  | "dashboard"
  | "diagnostic"
  | "today"
  | "review"
  | "context"
  | "sentence"
  | "passage"
  | "errors"
  | "stats"
  | "library"
  | "settings";
const nav: [Page, string, typeof BookOpen][] = [
  ["dashboard", "대시보드", LayoutDashboard],
  ["diagnostic", "초기 어휘 진단", Compass],
  ["today", "오늘의 학습", Layers],
  ["review", "복습 대기열", RotateCcw],
  ["context", "문맥별 의미", ScanText],
  ["sentence", "문장 정밀해석", FileText],
  ["passage", "장문 독해", BookOpen],
  ["errors", "오답 노트", NotebookPen],
  ["stats", "학습 통계", ChartNoAxesCombined],
  ["library", "단어 검색", Search],
  ["settings", "설정 및 데이터", Settings],
];
interface DataReport {
  counts: {
    candidates: number;
    learningWords: number;
    learningExpressions: number;
    senses: number;
    expressions: number;
    examples: number;
    humanReviewed: number;
    duplicatesMerged: number;
  };
  sources: { id: string; url: string; license: string; rows: number }[];
}
export default function App() {
  const [state, setState] = useState<State>(emptyState),
    [all, setAll] = useState<Sense[]>([]),
    [candidates, setCandidates] = useState<Candidate[]>([]),
    [report, setReport] = useState<DataReport | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState<Page>("dashboard"),
    [session, setSession] = useState<StudySession | null>(null),
    [mobile, setMobile] = useState(false),
    [offline, setOffline] = useState(false),
    [pendingRestore, setPendingRestore] = useState<State | null>(null),
    [restoreText, setRestoreText] = useState(""),
    [saving, setSaving] = useState(false),
    [pendingContent, setPendingContent] = useState<ReturnType<
      typeof contentSchema.parse
    > | null>(null);
  const current = useRef(state),
    locked = useRef(false);
  useEffect(() => {
    let alive = true;
    Promise.all([
      loadState(),
      fetch("/vocabulary.json").then((r) => {
        if (!r.ok) throw Error("어휘 파일 로딩 실패");
        return r.json();
      }),
      fetch("/candidates.json").then((r) => r.json()),
      fetch("/data-report.json").then((r) => r.json()),
      loadVocabulary(),
    ])
      .then(([s, v, c, r, stored]) => {
        if (alive) {
          setState(s);
          current.current = s;
          setAll(stored?.senses ?? v);
          setCandidates(stored?.candidates ?? c);
          setReport(
            stored ? reportFor(stored.senses, stored.candidates, r) : r,
          );
          setReady(true);
        }
      })
      .catch((e) => {
        if (alive)
          setError(
            "데이터를 열 수 없습니다. 기존 기록은 변경하지 않았습니다. " +
              String(e),
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.dark
      ? "dark"
      : "light";
  }, [state.settings.dark]);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
    const handler = (e: MessageEvent) => {
      if (e.data === "OFFLINE_READY") setOffline(true);
    };
    navigator.serviceWorker.addEventListener("message", handler);
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(async () => {
        const keys = await caches.keys();
        setOffline(keys.some((x) => x.startsWith("rc-lab-")));
      })
      .catch(() => setOffline(false));
    return () =>
      navigator.serviceWorker.removeEventListener("message", handler);
  }, []);
  async function update(fn: (s: State) => State) {
    if (locked.current) return false;
    locked.current = true;
    setSaving(true);
    try {
      const next = await updateStoredState(fn);
      current.current = next;
      setState(next);
      setError("");
      return true;
    } catch (e) {
      setError(
        "저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요. " +
          String(e),
      );
      return false;
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  async function review(
    e: ReviewEvent,
    diagnostic?: { id: string; level: number; completed: boolean },
  ) {
    return update((s) => {
      const next = recordReview(s, e);
      if (diagnostic)
        next.diagnosis = {
          completed: diagnostic.completed || s.diagnosis.completed,
          sampled: [...new Set([...s.diagnosis.sampled, diagnostic.id])],
          level: diagnostic.level,
        };
      return next;
    });
  }
  function navigate(p: Page) {
    setPage(p);
    setSession(null);
    setMobile(false);
    window.scrollTo(0, 0);
  }
  function study(
    items: Sense[],
    mode: StudySession["mode"] = "flash",
    label = "의미별 학습",
  ) {
    setSession({ items, mode, label });
    window.scrollTo(0, 0);
  }
  const summary = stats(state, Date.now(), all),
    due = queue(state, all, "review"),
    today = queue(state, all),
    mistakes = queue(state, all, "errors");
  const title = nav.find((n) => n[0] === page)?.[1] ?? "대시보드";
  const verified = state.events.filter((e) => e.correct !== null);
  const weakest = Object.entries(domains)
    .map(([id, name]) => {
      const ids = new Set(all.filter((s) => s.domain === id).map((s) => s.id));
      const ev = verified.filter((e) => ids.has(e.senseId));
      return {
        id,
        name,
        total: ev.length,
        accuracy: ev.length
          ? Math.round((ev.filter((e) => e.correct).length / ev.length) * 100)
          : null,
      };
    })
    .sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101));
  async function importFile(file: File) {
    setPendingRestore(null);
    try {
      if (file.size > 50000000) throw Error("50MB 이하 파일만 지원합니다.");
      const raw = await file.text();
      const parsed = backupSchema.parse(JSON.parse(raw));
      const ids = new Set(all.map((s) => s.id));
      if (parsed.events.some((e) => !ids.has(e.senseId)))
        throw Error(
          "현재 어휘 데이터에 없는 의미가 포함되어 있습니다. 해당 어휘 버전을 먼저 설치하세요.",
        );
      setPendingRestore(parsed);
      setRestoreText(raw);
      setError("");
    } catch {
      setError(
        "복원할 수 없습니다. 백업 형식과 어휘 버전을 확인하세요. 기존 데이터는 유지됩니다.",
      );
    }
  }
  async function doRestore() {
    if (locked.current) return;
    locked.current = true;
    try {
      const s = await restoreBackup(restoreText);
      setState(s);
      current.current = s;
      setPendingRestore(null);
      setError("");
    } catch {
      setError("복원에 실패했습니다. 기존 기록은 유지됩니다.");
    } finally {
      locked.current = false;
    }
  }
  if (!ready)
    return (
      <div className="loading">
        <BookOpen size={36} />
        <h1>나의 학습실을 준비하고 있어요</h1>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <p>어휘와 학습 기록을 불러오는 중입니다.</p>
        )}
      </div>
    );
  const count = report!.counts;
  return (
    <div className="app">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <span className="brand-icon">
            <BookOpen size={23} />
          </span>
          <div>
            RC <b>Lab</b>
            <small>VOCABULARY MASTERY</small>
          </div>
        </a>
        <button
          className="close-nav"
          aria-label="메뉴 닫기"
          onClick={() => setMobile(false)}
        >
          <X />
        </button>
        <div className="profile">
          <span className="avatar">나</span>
          <div>
            <strong>나만의 어휘 학습실</strong>
            <small>390에서 495를 향해</small>
          </div>
          <Leaf size={16} />
        </div>
        <p className="nav-label">MY LEARNING</p>
        <nav>
          {nav.map(([id, label, Icon], i) => (
            <div key={id}>
              {i === 7 && <p className="nav-label">MY PROGRESS</p>}
              <button
                className={page === id ? "active" : ""}
                onClick={() => navigate(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {id === "review" && summary.due > 0 && (
                  <span className="nav-count">{summary.due}</span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="goal">
            <Target size={18} />
            <span>
              정확한 이해가 쌓이는 곳<small>목표 TOEIC RC 495</small>
            </span>
          </div>
          <span className="offline" data-testid="offline-status">
            <span className={offline ? "status-dot" : "status-dot pending"} />
            {offline ? "오프라인 준비 완료" : "로컬 학습 · 오프라인 준비 중"}
          </span>
        </div>
      </aside>
      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}
      <main className="main">
        <header className="topbar">
          <button
            className="menu"
            aria-label="메뉴 열기"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            나의 학습실 <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <span className="local-label">
              <ShieldCheck size={14} />
              {saving ? "저장 중" : "이 기기에 안전하게 저장"}
            </span>
            <button
              className="icon-button"
              aria-label={state.settings.dark ? "라이트 모드" : "다크 모드"}
              onClick={() =>
                void update((s) => ({
                  ...s,
                  settings: { ...s.settings, dark: !s.settings.dark },
                }))
              }
            >
              {state.settings.dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="avatar small">나</span>
          </div>
        </header>
        <div className="content">
          {error && (
            <div role="alert" className="alert">
              {error}
              <button onClick={() => setError("")} aria-label="오류 닫기">
                <X size={16} />
              </button>
            </div>
          )}
          {session ? (
            <Learning
              key={session.label + session.mode}
              session={session}
              state={state}
              all={all}
              onReview={review}
              onFinish={() => navigate("dashboard")}
              onNavigate={() => navigate("review")}
            />
          ) : (
            <>
              {page === "dashboard" && (
                <>
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">YOUR DAILY LEARNING SPACE</p>
                      <h1>오늘도, 한 걸음 더 정확하게.</h1>
                      <p>아는 단어를 넘어, 문맥을 이해하는 힘을 길러보세요.</p>
                    </div>
                    <span className="date">
                      {new Intl.DateTimeFormat("ko-KR", {
                        month: "long",
                        day: "numeric",
                        weekday: "long",
                      }).format(new Date())}
                    </span>
                  </div>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-label">
                        <span />
                        오늘의 학습 루틴
                      </span>
                      <h2>
                        추측하던 단어를,
                        <br />
                        확실한 나의 언어로.
                      </h2>
                      <p>
                        복습으로 기억을 다지고, 새로운 문맥으로 확인하세요.
                        <br className="desktop-only" />
                        오늘의 작은 반복이 정확한 독해를 만듭니다.
                      </p>
                      <div className="hero-actions">
                        <button
                          className="light-button"
                          onClick={() => study(today, "flash", "오늘의 학습")}
                        >
                          오늘 학습 시작하기 <ArrowRight size={18} />
                        </button>
                        <span>
                          신규 {Math.max(0, today.length - due.length)} · 복습{" "}
                          {due.length}
                        </span>
                      </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit one" />
                      <div className="orbit two" />
                      <div className="floating-card back">
                        <span>receipt</span>
                        <small>문맥이 달라지면, 의미도 달라집니다.</small>
                      </div>
                      <div className="floating-card front">
                        <div>
                          <span className="tiny-label">WORD IN CONTEXT</span>
                          <Sparkles size={18} />
                        </div>
                        <strong>outstanding</strong>
                        <p>뛰어난, 그리고 미결제의</p>
                        <div className="art-line" />
                        <span className="art-chip">
                          <Check size={13} /> 하나의 단어, 더 넓은 이해
                        </span>
                      </div>
                      <Sparkles className="art-star" size={29} />
                    </div>
                  </section>
                  <div className="stats-grid">
                    <Metric
                      label="학습한 표제어"
                      value={summary.words}
                      caption={`${summary.senses}개 개별 의미 학습`}
                      testid="learned-words"
                      icon={<BookOpen size={19} />}
                    />
                    <Metric
                      label="숙달한 의미"
                      value={summary.mastered}
                      caption="새 문맥 · 인출 검증 기준"
                      icon={<ShieldCheck size={19} />}
                    />
                    <Metric
                      label="복습할 의미"
                      value={summary.due}
                      caption="지금 다시 떠올릴 시간"
                      icon={<RotateCcw size={19} />}
                    />
                    <Metric
                      label="오늘의 학습 기록"
                      value={summary.today}
                      caption={`신규 ${summary.newToday} · 복습 ${summary.reviewsToday}`}
                      icon={<Check size={19} />}
                    />
                  </div>
                  <div className="dashboard-columns">
                    <div>
                      <div className="section-heading">
                        <h2>나에게 필요한 학습</h2>
                        <span className="muted">
                          정확도를 먼저, 속도는 그다음
                        </span>
                      </div>
                      <div className="path-grid">
                        <button
                          className="panel path-card"
                          onClick={() =>
                            navigate(
                              state.diagnosis.completed
                                ? "context"
                                : "diagnostic",
                            )
                          }
                        >
                          <span className="path-icon mint">
                            <Compass size={23} />
                          </span>
                          <span className="tag">
                            {state.diagnosis.completed
                              ? "전이 학습"
                              : "처음이라면"}
                          </span>
                          <h3>
                            {state.diagnosis.completed
                              ? "새 문맥에서 확인하기"
                              : "나의 어휘 공백 찾기"}
                          </h3>
                          <p>
                            {state.diagnosis.completed
                              ? "알고 있다고 생각한 뜻을 새로운 문장에서 확인해요."
                              : "12개 표본으로 시작하는 적응형 진단. 추측과 이해를 구분해요."}
                          </p>
                          <span className="path-link">
                            {state.diagnosis.completed
                              ? "문맥 학습"
                              : "진단 시작"}{" "}
                            <ArrowUpRight size={18} />
                          </span>
                        </button>
                        <button
                          className="panel path-card"
                          onClick={() => navigate("sentence")}
                        >
                          <span className="path-icon lavender">
                            <ScanText size={23} />
                          </span>
                          <span className="tag">독해로 연결</span>
                          <h3>한 문장, 깊이 이해하기</h3>
                          <p>
                            대충 읽고 지나친 문장을 의미 단위로 천천히
                            살펴보세요.
                          </p>
                          <span className="path-link">
                            정밀해석 시작 <ArrowUpRight size={18} />
                          </span>
                        </button>
                      </div>
                      <div className="section-heading">
                        <h2>다시 살펴볼 단어</h2>
                        <button
                          className="text-button"
                          onClick={() => navigate("errors")}
                        >
                          오답 노트 <ChevronRight size={15} />
                        </button>
                      </div>
                      <section className="panel focus-list">
                        {(mistakes.length
                          ? mistakes
                          : all.filter((s) =>
                              ["tentative", "prospective", "retain"].includes(
                                s.lemma,
                              ),
                            )
                        )
                          .slice(0, 3)
                          .map((s) => (
                            <button
                              key={s.id}
                              onClick={() =>
                                study([s], "context", "취약 의미 확인")
                              }
                            >
                              <span className="word-initial">
                                {s.lemma.slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <strong>{s.lemma}</strong>
                                <span>{s.meaning}</span>
                              </div>
                              <span className="tag">
                                {mistakes.length
                                  ? "다시 확인"
                                  : "이전 오답 · 검증 대기"}
                              </span>
                              <ArrowRight size={16} />
                            </button>
                          ))}
                      </section>
                    </div>
                    <aside>
                      <section className="panel daily-panel">
                        <div className="section-heading">
                          <h2>오늘의 발자국</h2>
                          <span className="tag">DAILY</span>
                        </div>
                        <div
                          className="progress-ring"
                          style={
                            {
                              "--progress": `${Math.min(100, (summary.newToday / state.settings.dailyNew) * 100)}%`,
                            } as React.CSSProperties
                          }
                        >
                          <div>
                            <strong>
                              {summary.newToday}
                              <small> / {state.settings.dailyNew}</small>
                            </strong>
                            <span>신규 의미 목표</span>
                          </div>
                        </div>
                        <p>
                          {summary.today
                            ? "좋아요. 오늘의 학습이 기록되고 있어요."
                            : "첫 학습을 시작하면 기록이 쌓여요."}
                        </p>
                        <div className="daily-line">
                          <span>문맥 테스트 정답률</span>
                          <strong>
                            {summary.accuracy === null
                              ? "기록 없음"
                              : summary.accuracy + "%"}
                          </strong>
                        </div>
                        <div className="daily-line">
                          <span>진단한 의미</span>
                          <strong>{state.diagnosis.sampled.length}개</strong>
                        </div>
                        <div className="daily-line">
                          <span>학습한 카드 ≠ 숙달 어휘</span>
                          <ShieldCheck size={16} />
                        </div>
                      </section>
                      <section className="insight">
                        <div>
                          <LightIcon />
                          <span>LEARNING NOTE</span>
                        </div>
                        <h3>
                          “안다”는 느낌,
                          <br />새 문맥에서도 같을까요?
                        </h3>
                        <p>
                          자기 평가로 익힌 단어는 새로운 문장 속에서 다시
                          확인해야 합니다.
                        </p>
                        <button
                          className="text-button"
                          onClick={() => navigate("context")}
                        >
                          문맥별 의미 학습 <ArrowRight size={15} />
                        </button>
                      </section>
                    </aside>
                  </div>
                  <div className="database-strip">
                    <span>
                      <BookOpen size={18} />
                      나의 어휘 데이터베이스
                    </span>
                    <p>
                      후보 <b>{count.candidates.toLocaleString()}</b> · 학습
                      가능 <b>{count.learningWords}</b> 표제어 +{" "}
                      <b>{count.learningExpressions}</b> 표현 항목 ·{" "}
                      <b>{count.senses}</b> 의미 · <b>{count.expressions}</b>{" "}
                      표현
                    </p>
                    <button onClick={() => navigate("library")}>
                      둘러보기 <ArrowRight size={15} />
                    </button>
                  </div>
                </>
              )}
              {page !== "dashboard" && (
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">
                      {page === "library"
                        ? "YOUR VOCABULARY LIBRARY"
                        : "BUILD UNDERSTANDING, ONE STEP AT A TIME"}
                    </p>
                    <h1>{title}</h1>
                    <p>
                      {page === "stats"
                        ? "추측한 정답과 검증한 이해를 구분해서 살펴봅니다."
                        : page === "settings"
                          ? "학습 데이터는 이 브라우저에 저장됩니다. 정기적으로 백업하세요."
                          : "뜻을 떠올리고, 문맥에서 확인하고, 오래 기억하세요."}
                    </p>
                  </div>
                </div>
              )}
              {page === "diagnostic" && (
                <section className="panel introduction">
                  <span className="path-icon mint">
                    <Compass size={32} />
                  </span>
                  <h2>지금의 이해에서 시작합니다</h2>
                  <p>
                    다양한 분야와 난이도의 12개 의미를 표본으로 확인합니다.
                    응답에 따라 다음 문제의 난이도가 조절됩니다. 객관식과 핵심
                    뜻 인출을 함께 사용하며, 결과는 전체 어휘량이나 TOEIC 점수로
                    환산하지 않습니다.
                  </p>
                  <div className="diagnostic-stages">
                    {[
                      "단어 자체를 모름",
                      "해당 의미를 모름",
                      "문장 이해 확인",
                      "느린 인출",
                      "새 문맥에서 확인",
                    ].map((x, i) => (
                      <div key={x}>
                        <span>0{i + 1}</span>
                        {x}
                      </div>
                    ))}
                  </div>
                  <p className="notice">
                    과거 15개 중 12개를 안다고 표시한 기록은 자기 보고로만
                    취급합니다. tentative · prospective · retain은 우선
                    검증합니다.
                  </p>
                  <button
                    className="primary"
                    onClick={() => study(all, "diagnostic", "적응형 어휘 진단")}
                  >
                    {state.diagnosis.completed
                      ? "새 표본으로 다시 진단"
                      : "12개 표본 진단 시작"}{" "}
                    <ArrowRight size={16} />
                  </button>
                </section>
              )}
              {(page === "today" ||
                page === "review" ||
                page === "context") && (
                <>
                  <section className="panel study-intro">
                    <div>
                      <span className="tag">
                        {page === "context"
                          ? "다의어 · 새 문맥 확인"
                          : "SPACED REPETITION"}
                      </span>
                      <h2>
                        {page === "review"
                          ? `${due.length}개 의미가 복습을 기다려요`
                          : page === "context"
                            ? "문장이 바뀌어도 이해할 수 있도록"
                            : `오늘은 ${today.length}개 의미에 집중해요`}
                      </h2>
                      <p>
                        {page === "context"
                          ? "객관식과 짧은 뜻 인출을 번갈아 수행합니다. 확신도와 응답 시간은 정답 여부와 별도로 기록합니다."
                          : "카드 앞면에서 답을 떠올린 뒤 뒤집으세요. 자기 평가만으로 숙달 판정하지 않습니다."}
                      </p>
                      <button
                        className="primary"
                        disabled={page === "review" && !due.length}
                        onClick={() =>
                          study(
                            page === "review"
                              ? due
                              : page === "context"
                                ? contextQueue(state, all).slice(0, 12)
                                : today,
                            page === "context" ? "context" : "flash",
                            title,
                          )
                        }
                      >
                        학습 시작 <ArrowRight size={17} />
                      </button>
                      {page === "context" && (
                        <button
                          className="collocation-start"
                          onClick={() =>
                            study(
                              contextQueue(state, all)
                                .filter((s) => s.expressions.length)
                                .slice(0, 12),
                              "collocation",
                              "연어 이해 확인",
                            )
                          }
                        >
                          연어 이해 확인
                        </button>
                      )}
                    </div>
                    <div className="session-number">
                      <strong>
                        {page === "review"
                          ? due.length
                          : page === "context"
                            ? 12
                            : today.length}
                      </strong>
                      <span>개의 의미</span>
                      <small>Space 뒤집기 · 1–5 자기 평가</small>
                    </div>
                  </section>
                  <div className="section-heading">
                    <h2>
                      {page === "review"
                        ? "다음 복습 계획"
                        : "학습할 의미 미리보기"}
                    </h2>
                    <span className="muted">표제어별이 아닌 의미별 일정</span>
                  </div>
                  <section className="panel queue-list">
                    {(page === "review"
                      ? all
                          .filter((s) => state.cards[s.id])
                          .sort(
                            (a, b) =>
                              state.cards[a.id].due - state.cards[b.id].due,
                          )
                      : page === "context"
                        ? contextQueue(state, all).slice(0, 12)
                        : today
                    )
                      .slice(0, 50)
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() =>
                            study(
                              [s],
                              page === "context" ? "context" : "flash",
                              "선택한 의미 학습",
                            )
                          }
                        >
                          <div>
                            <strong>{s.lemma}</strong>
                            <span>{s.meaning}</span>
                          </div>
                          <span className="tag">{domains[s.domain]}</span>
                          <small>
                            {state.cards[s.id]
                              ? new Date(state.cards[s.id].due).toLocaleString(
                                  "ko-KR",
                                )
                              : "신규"}
                          </small>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                    {page === "review" && !Object.keys(state.cards).length && (
                      <div className="empty">
                        <Clock />
                        <h3>아직 복습 일정이 없어요</h3>
                        <p>학습을 시작하면 의미별 일정이 만들어집니다.</p>
                      </div>
                    )}
                  </section>
                </>
              )}
              {(page === "sentence" || page === "passage") && (
                <Reading
                  key={page}
                  kind={page}
                  state={state}
                  onSave={(r: ReadingResult) =>
                    update((s) => ({ ...s, reading: [...s.reading, r] }))
                  }
                  onStudy={(lemmas) =>
                    study(
                      all.filter((s) => lemmas.includes(s.lemma)),
                      "context",
                      "독해 핵심 어휘",
                    )
                  }
                />
              )}
              {page === "library" && (
                <Library
                  all={all}
                  candidates={candidates}
                  state={state}
                  onStudy={(items) => study(items)}
                  onNote={(id, text) =>
                    update((s) => ({ ...s, notes: { ...s.notes, [id]: text } }))
                  }
                />
              )}
              {page === "errors" && (
                <>
                  <section className="panel study-intro">
                    <div>
                      <h2>틀린 이유를 알면, 다음 문장이 달라져요.</h2>
                      <p>
                        오답과 낮은 확신도의 정답을 함께 기록합니다. 새 예문이
                        준비된 의미는 우선 새로운 문맥으로 보여줍니다.
                      </p>
                      <button
                        className="primary"
                        disabled={!mistakes.length}
                        onClick={() =>
                          study(mistakes, "context", "오답 문맥 복습")
                        }
                      >
                        오답 다시 학습 <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="session-number">
                      <strong>{mistakes.length}</strong>
                      <span>다시 확인할 의미</span>
                    </div>
                  </section>
                  <section className="panel queue-list">
                    {mistakes.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => study([s], "context", "오답 의미 확인")}
                      >
                        <div>
                          <strong>{s.lemma}</strong>
                          <span>{s.meaning}</span>
                        </div>
                        <small>
                          오답{" "}
                          {
                            state.events.filter(
                              (e) => e.senseId === s.id && e.correct === false,
                            ).length
                          }
                          회 · 자기 평가 오답{" "}
                          {
                            state.events.filter(
                              (e) =>
                                e.senseId === s.id &&
                                e.kind === "self" &&
                                e.rating < 2,
                            ).length
                          }
                          회
                        </small>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                    {!mistakes.length && (
                      <div className="empty">
                        <NotebookPen />
                        <h3>기록이 쌓이면 패턴이 보여요</h3>
                        <p>
                          학습 중 틀리거나 확신이 낮았던 의미가 이곳에 모입니다.
                        </p>
                      </div>
                    )}
                  </section>
                  <h2 className="subheading">독해 점검 기록</h2>
                  <div className="panel queue-list">
                    {state.reading
                      .filter(readingNeedsReview)
                      .slice(-20)
                      .reverse()
                      .map((r) => (
                        <div className="history-row" key={r.id}>
                          <strong>
                            {r.kind === "sentence" ? "문장 해석" : "장문 독해"}{" "}
                            · {r.correct}/{r.total}
                          </strong>
                          <span>
                            {r.errorType} · 확신도 {r.confidence}
                          </span>
                          <small>
                            {new Date(r.at).toLocaleDateString("ko-KR")}
                          </small>
                        </div>
                      ))}
                    {!state.reading.length && (
                      <p className="empty">독해 기록이 아직 없습니다.</p>
                    )}
                  </div>
                </>
              )}
              {page === "stats" && (
                <>
                  <div className="stats-grid">
                    <Metric
                      label="학습한 표제어"
                      value={summary.words}
                      caption={`${summary.senses}개 의미`}
                    />
                    <Metric
                      label="검증한 의미"
                      value={summary.tested}
                      caption="자기 평가 제외"
                    />
                    <Metric
                      label="숙달 의미"
                      value={summary.mastered}
                      caption="3일 이상 · 다른 문맥 · 인출"
                    />
                    <Metric
                      label="확인된 정답률"
                      value={
                        summary.accuracy === null ? "—" : `${summary.accuracy}%`
                      }
                      caption={`${verified.length}회 테스트`}
                    />
                  </div>
                  <div className="two-columns">
                    <section className="panel analytics">
                      <h2>분야별 이해도</h2>
                      <p className="muted">
                        실제 테스트가 없는 분야는 미측정입니다.
                      </p>
                      {weakest.map((d) => (
                        <div className="bar-row" key={d.id}>
                          <span>{d.name}</span>
                          <div className="bar">
                            <i style={{ width: `${d.accuracy ?? 0}%` }} />
                          </div>
                          <strong>
                            {d.accuracy === null ? "—" : d.accuracy + "%"}
                          </strong>
                          <small>{d.total}회</small>
                        </div>
                      ))}
                    </section>
                    <div>
                      <section className="panel analytics">
                        <h2>최근 7일 학습 추세</h2>
                        <div className="trend">
                          {Array.from({ length: 7 }, (_, i) => {
                            const d = new Date();
                            d.setDate(d.getDate() - 6 + i);
                            const n = state.events.filter(
                              (e) =>
                                new Date(e.at).toDateString() ===
                                d.toDateString(),
                            ).length;
                            return (
                              <div key={i}>
                                <span>{n}</span>
                                <i
                                  style={{
                                    height: `${Math.min(110, n * 6) + 3}px`,
                                  }}
                                />
                                <small>
                                  {d.getMonth() + 1}/{d.getDate()}
                                </small>
                              </div>
                            );
                          })}
                        </div>
                        <p className="muted">
                          막대는 학습 기록 수입니다. 숙달 어휘 수와 다릅니다.
                        </p>
                      </section>
                      <section className="panel analytics">
                        <h2>독해로 이어지는 변화</h2>
                        {(["sentence", "passage"] as const).map((kind) => {
                          const rows = state.reading.filter(
                            (r) => r.kind === kind,
                          );
                          const total = rows.reduce((n, r) => n + r.total, 0);
                          const correct = rows.reduce(
                            (n, r) => n + r.correct,
                            0,
                          );
                          return (
                            <div className="daily-line" key={kind}>
                              <span>
                                {kind === "sentence"
                                  ? "정밀해석 · 자기 확인"
                                  : "장문 독해 · 객관식"}
                              </span>
                              <strong>
                                {total
                                  ? Math.round((correct / total) * 100) + "%"
                                  : "기록 없음"}
                              </strong>
                            </div>
                          );
                        })}
                        <div className="daily-line">
                          <span>장문 독해 속도</span>
                          <strong>
                            {(() => {
                              const r = state.reading.filter(
                                (x) => x.kind === "passage",
                              );
                              return r.length
                                ? Math.round(
                                    (r.reduce((n, x) => n + x.words, 0) /
                                      r.reduce((n, x) => n + x.seconds, 0)) *
                                      60,
                                  ) + " 단어/분"
                                : "기록 없음";
                            })()}
                          </strong>
                        </div>
                        <p className="muted">
                          시간은 읽기와 문제 풀이를 합친 관찰값입니다. 지문
                          난이도가 달라 단순 비교에 주의하세요.
                        </p>
                      </section>
                      <section className="panel analytics">
                        <h2>이해 단계 관찰</h2>
                        <p className="muted">
                          실패 유형은 본인 보고, 느린 인출은 10초 초과
                          기준입니다. 점수 예측에 사용하지 않습니다.
                        </p>
                        {[
                          "단어 자체를 모름",
                          "단어는 알지만 해당 의미를 모름",
                          "뜻은 알지만 문장에서 이해하지 못함",
                          "느린 인출",
                          "새 문맥에서 빠른 이해",
                          "문장 이해 확인",
                        ].map((k) => (
                          <div className="daily-line" key={k}>
                            <span>{k}</span>
                            <strong>
                              {
                                state.events.filter((e) => e.errorType === k)
                                  .length
                              }
                              회
                            </strong>
                          </div>
                        ))}
                      </section>
                      <section className="panel analytics">
                        <h2>다의어 · 연어</h2>
                        <p>
                          다의어 학습 의미:{" "}
                          {
                            Object.keys(state.cards).filter((id) => {
                              const s = all.find((x) => x.id === id);
                              return (
                                s &&
                                all.filter((x) => x.wordId === s.wordId)
                                  .length > 1
                              );
                            }).length
                          }
                          개
                        </p>
                        <p>
                          연어 이해도:{" "}
                          {collocationAccuracy(state) === null
                            ? "미측정"
                            : collocationAccuracy(state) + "%"}{" "}
                          ·{" "}
                          {
                            state.events.filter((e) => e.kind === "collocation")
                              .length
                          }
                          회
                        </p>
                        <p className="muted">
                          연어 선택 테스트 결과만 집계합니다. 뜻을 본 것만으로
                          이해를 인정하지 않습니다. 예상 TOEIC 점수는 산출하지
                          않습니다.
                        </p>
                      </section>
                    </div>
                  </div>
                </>
              )}
              {page === "settings" && (
                <div className="settings-grid">
                  <section className="panel settings-panel">
                    <h2>나의 학습 설정</h2>
                    <label className="field">
                      하루 신규 의미 목표
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={state.settings.dailyNew}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (v >= 1 && v <= 100)
                            void update((s) => ({
                              ...s,
                              settings: { ...s.settings, dailyNew: v },
                            }));
                        }}
                      />
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={state.settings.dark}
                        onChange={(e) =>
                          void update((s) => ({
                            ...s,
                            settings: { ...s.settings, dark: e.target.checked },
                          }))
                        }
                      />
                      다크 모드
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={state.settings.timed}
                        onChange={(e) =>
                          void update((s) => ({
                            ...s,
                            settings: {
                              ...s.settings,
                              timed: e.target.checked,
                            },
                          }))
                        }
                      />
                      독해 3분 목표 타이머 표시
                    </label>
                    <p className="muted">
                      정확도 중심으로 시작하고, 익숙해지면 시간 목표를
                      사용하세요.
                    </p>
                  </section>
                  <section className="panel settings-panel">
                    <h2>학습 기록 백업과 복원</h2>
                    <p>
                      JSON은 기록·복습 일정·설정·메모를 복원할 수 있는
                      백업입니다. CSV는 기록 분석용입니다.
                    </p>
                    <div className="stack">
                      <button
                        onClick={() =>
                          download(
                            `rc-lab-backup-${new Date().toISOString().slice(0, 10)}.json`,
                            JSON.stringify(state, null, 2),
                          )
                        }
                      >
                        <Download size={17} />
                        JSON 백업 내보내기
                      </button>
                      <button
                        onClick={() =>
                          download(
                            "rc-lab-history.csv",
                            csv(state),
                            "text/csv;charset=utf-8",
                          )
                        }
                      >
                        <Download size={17} />
                        CSV 기록 내보내기
                      </button>
                      <label className="file-label">
                        <Upload size={17} />
                        백업 파일 선택
                        <input
                          aria-label="백업 파일 선택"
                          type="file"
                          accept=".json,application/json"
                          onChange={(e) => {
                            if (e.target.files?.[0])
                              void importFile(e.target.files[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {pendingRestore && (
                      <div className="restore-preview">
                        <strong>
                          복원할 기록: {pendingRestore.events.length}회 ·{" "}
                          {Object.keys(pendingRestore.cards).length}개 의미
                        </strong>
                        <p>
                          현재 기록을 이 백업으로 교체합니다. 먼저 현재 기록을
                          내보낼 수 있습니다.
                        </p>
                        <button
                          className="primary"
                          onClick={() => void doRestore()}
                        >
                          이 백업으로 복원
                        </button>
                        <button onClick={() => setPendingRestore(null)}>
                          취소
                        </button>
                      </div>
                    )}
                    <p className="muted">
                      브라우저 데이터 삭제 또는 기기 변경에 대비해 백업을
                      보관하세요. 복원 직전 데이터도 IndexedDB에 한 번
                      보관합니다.
                    </p>
                  </section>
                  <section className="panel settings-panel">
                    <h2>어휘 데이터와 출처</h2>
                    <div className="data-counts">
                      <p>
                        전체 후보{" "}
                        <strong>{count.candidates.toLocaleString()}</strong>
                      </p>
                      <p>
                        학습 가능 표제어 <strong>{count.learningWords}</strong>
                      </p>
                      <p>
                        별도 학습 표현 항목{" "}
                        <strong>{count.learningExpressions}</strong>
                      </p>
                      <p>
                        의미 / 표현{" "}
                        <strong>
                          {count.senses} / {count.expressions}
                        </strong>
                      </p>
                      <p>
                        예문 <strong>{count.examples}</strong>
                      </p>
                      <p>
                        사람 검수 완료 <strong>{count.humanReviewed}</strong>
                      </p>
                      <p>
                        원본 목록 중복 병합{" "}
                        <strong>{count.duplicatesMerged}</strong>
                      </p>
                    </div>
                    <p className="notice">
                      생성된 뜻·예문은 구조 검증을 통과했지만 사람의 언어 검수는
                      아직 받지 않았습니다. 검수 필요 상태를 유지합니다.
                    </p>
                    <button
                      onClick={() =>
                        download(
                          "rc-lab-vocabulary.json",
                          JSON.stringify(
                            { senses: all, candidates, report },
                            null,
                            2,
                          ),
                        )
                      }
                    >
                      <Download size={17} />
                      어휘 데이터 내보내기
                    </button>
                    <label className="file-label">
                      어휘 데이터 복원
                      <input
                        aria-label="어휘 데이터 복원"
                        type="file"
                        accept=".json"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          try {
                            if (file.size > 50000000) throw Error();
                            setPendingContent(
                              contentSchema.parse(
                                JSON.parse(await file.text()),
                              ),
                            );
                            setError("");
                          } catch {
                            setError(
                              "어휘 파일을 복원할 수 없습니다. 형식·중복 ID·필수 필드를 확인하세요.",
                            );
                          }
                        }}
                      />
                    </label>
                    {pendingContent && (
                      <div className="restore-preview">
                        <p>
                          {pendingContent.senses.length}개 의미를 이 기기의 어휘
                          데이터로 복원합니다. 기존 학습 기록에 필요한 의미는
                          삭제할 수 없습니다.
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              await saveVocabulary(pendingContent);
                              setAll(pendingContent.senses);
                              setCandidates(pendingContent.candidates);
                              setReport(
                                reportFor(
                                  pendingContent.senses,
                                  pendingContent.candidates,
                                  report!,
                                ),
                              );
                              setPendingContent(null);
                              setError("");
                            } catch {
                              setError(
                                "학습 기록과 충돌하여 어휘를 복원하지 않았습니다.",
                              );
                            }
                          }}
                        >
                          어휘 복원 실행
                        </button>
                        <button onClick={() => setPendingContent(null)}>
                          취소
                        </button>
                      </div>
                    )}
                    {report?.sources.map((s) => (
                      <p key={s.id}>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.id.toUpperCase()} 원본
                        </a>{" "}
                        · {s.license}
                      </p>
                    ))}
                    <p className="muted">
                      단어 목록: Browne·Culligan (NGSL: Phillips 포함). 뜻·예문:
                      자체 작성. 사용자가 만든 테스트가 아닌 실제 TOEIC 문제는
                      포함하지 않습니다.
                    </p>
                  </section>
                  <section className="panel settings-panel">
                    <h2>학습 기준과 데이터 소유권</h2>
                    <p>
                      SM-2 원리를 기반으로 실패 시 10분, 성공 시 1일·6일·이후
                      난이도 계수에 따라 복습합니다. 확신이 낮으면 최대 1일,
                      자기 평가는 최대 7일로 제한합니다.
                    </p>
                    <p>
                      숙달은 서로 다른 문맥, 핵심 뜻 인출, 3일 이상에 걸친
                      성공을 요구합니다. 이 기준은 앱의 보수적 관찰 기준이며
                      TOEIC 만점을 보장하지 않습니다.
                    </p>
                    <p>
                      API 키나 계정 없이 이용할 수 있습니다. 번역은 자동
                      채점하지 않고 의미 체크리스트로 직접 확인합니다.
                    </p>
                    <p>
                      어휘 데이터 확장은 프로젝트의{" "}
                      <code>npm run data:next</code>와 검증 파이프라인으로
                      이어갈 수 있습니다.
                    </p>
                    <button
                      onClick={() =>
                        void navigator.storage
                          ?.persist?.()
                          .then((v) =>
                            setError(
                              v
                                ? "영구 저장 요청이 승인되었습니다."
                                : "브라우저가 영구 저장 요청을 승인하지 않았습니다. JSON 백업을 이용하세요.",
                            ),
                          )
                      }
                    >
                      브라우저 영구 저장 요청
                    </button>
                  </section>
                </div>
              )}
            </>
          )}
          <footer>
            RC Lab <span>작은 반복, 깊어지는 이해.</span>
            <span>개인 학습용 · RC 495를 향한 여정</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
function Metric({
  label,
  value,
  caption,
  icon,
  testid,
}: {
  label: string;
  value: number | string;
  caption: string;
  icon?: React.ReactNode;
  testid?: string;
}) {
  return (
    <section className="panel metric">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong data-testid={testid}>{value}</strong>
      <p>{caption}</p>
    </section>
  );
}
function LightIcon() {
  return <Sparkles size={18} />;
}

function reportFor(
  senses: Sense[],
  candidates: Candidate[],
  base: DataReport,
): DataReport {
  return {
    ...base,
    counts: {
      ...base.counts,
      candidates: candidates.length,
      learningWords: new Set(
        senses.filter((s) => s.pos !== "phrase").map((s) => s.wordId),
      ).size,
      learningExpressions: new Set(
        senses.filter((s) => s.pos === "phrase").map((s) => s.wordId),
      ).size,
      senses: senses.length,
      expressions: new Set(senses.flatMap((s) => s.expressions)).size,
      examples: senses.reduce((n, s) => n + s.examples.length, 0),
      humanReviewed: senses.filter((s) => s.reviewStatus === "reviewed").length,
    },
  };
}
