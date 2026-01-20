// src/App.tsx
import { useMemo, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import "./styles.css";

type PuzzleRound = { roundIndex: number; imageUrl: string };
type PuzzleResponse = { date: string; rounds: PuzzleRound[]; error?: string };

type Choice = "real" | "ai";

type AttemptResponse =
  | {
      ok: true;
      alreadySubmitted: boolean;
      puzzleDate: string;
      score: number;
      totalRounds: number;
      createdAt?: string | null;
    }
  | {
      error: string;
      puzzleDate?: string;
      totalRounds?: number;
      answered?: number;
      details?: string;
    };

function ensureUserId(): string {
  const k = "real_or_ai_user_id";
  const existing = localStorage.getItem(k);
  if (existing) return existing;
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `u_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  localStorage.setItem(k, id);
  return id;
}

type Screen = "home" | "game";

export default function App() {
  const apiBase = import.meta.env.VITE_API_BASE as string;
  const userId = useMemo(() => ensureUserId(), []);

  const [screen, setScreen] = useState<Screen>("home");

  const [puzzle, setPuzzle] = useState<PuzzleResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<number, Choice>>({});
  const [idx, setIdx] = useState(0);

  // Forward-only lock: highest roundIndex the user is allowed to answer.
  const [unlockedRoundIndex, setUnlockedRoundIndex] = useState<number | null>(
    null,
  );

  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState<AttemptResponse | null>(null);

  const rounds = puzzle?.rounds ?? [];
  const totalRounds = rounds.length || 5;

  const current = rounds[idx] ?? null;
  const isLast = idx === rounds.length - 1;

  const currentRoundIndex = current?.roundIndex ?? 0;
  const currentChoice = current ? answers[current.roundIndex] : undefined;

  const displayScore =
    attempt &&
    "ok" in attempt &&
    attempt.ok &&
    typeof attempt.score === "number"
      ? attempt.score
      : 0;

  const isCurrentLocked =
    submitting ||
    (attempt && "ok" in attempt && attempt.ok) ||
    unlockedRoundIndex === null ||
    currentRoundIndex !== unlockedRoundIndex;

  async function startGame() {
    try {
      setErr(null);
      setAttempt(null);

      const res = await fetch(`${apiBase}/api/puzzle/today`);
      const json = (await res.json()) as PuzzleResponse;

      if (!res.ok) {
        setPuzzle(null);
        setErr(json.error ?? `Failed to load puzzle (${res.status})`);
        return;
      }

      json.rounds.sort((a, b) => a.roundIndex - b.roundIndex);

      setPuzzle(json);
      setAnswers({});
      setIdx(0);
      setUnlockedRoundIndex(json.rounds[0]?.roundIndex ?? 1);

      setScreen("game");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  function setChoice(roundIndex: number, choice: Choice) {
    if (isCurrentLocked) return;
    setAnswers((prev) => ({ ...prev, [roundIndex]: choice }));
  }

  function next() {
    if (!current) return;

    if (!answers[current.roundIndex]) {
      setErr("Choose Real or AI to continue.");
      return;
    }

    setErr(null);

    if (!isLast) {
      const nextRound = rounds[idx + 1];
      setUnlockedRoundIndex(nextRound.roundIndex);
      setIdx((v) => Math.min(v + 1, rounds.length - 1));
      return;
    }

    submitAttempt();
  }

  async function submitAttempt() {
    if (!puzzle || !current) return;

    for (const r of rounds) {
      if (!answers[r.roundIndex]) {
        setErr(`Please answer Round ${r.roundIndex} before submitting.`);
        return;
      }
    }

    setErr(null);
    setSubmitting(true);
    setAttempt(null);

    try {
      const payload = {
        puzzleDate: puzzle.date,
        answers: Object.fromEntries(
          rounds.map((r) => [String(r.roundIndex), answers[r.roundIndex]]),
        ),
      };

      const res = await fetch(`${apiBase}/api/attempt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as AttemptResponse;

      if (!res.ok) {
        setAttempt(null);
        setErr(
          "error" in json
            ? json.details
              ? `${json.error}: ${json.details}`
              : json.error
            : `Submit failed (${res.status})`,
        );
        return;
      }

      setAttempt(json);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setAttempt(null);
    } finally {
      setSubmitting(false);
    }
  }

  const submitOrNextLabel = isLast
    ? submitting
      ? "Submitting…"
      : "Submit"
    : "Next";

  // -------------------------
  // HOME SCREEN
  // -------------------------
  if (screen === "home") {
    return (
      <div className="page">
        <header className="topbar">
          <div className="brand">IS IT REAL?</div>
          <button
            type="button"
            className="topbarBtn"
            onClick={() => alert("Add 'How to play' later.")}
          >
            How to play
          </button>
        </header>

        <main className="layout">
          <section className="stage" aria-label="Current round">
            <div className="imageFrame">
              {current ? (
                <TransformWrapper
                  initialScale={1}
                  minScale={1}
                  maxScale={5}
                  centerOnInit
                  wheel={{ step: 0.12 }} // smaller = less sensitive, bigger = more sensitive
                  doubleClick={{ disabled: true }}
                  panning={{ velocityDisabled: true }}
                >
                  <TransformComponent
                    wrapperClass="zoomWrap"
                    contentClass="zoomContent"
                  >
                    <img
                      className="imageZoom"
                      src={current.imageUrl}
                      alt={`Round ${current.roundIndex}`}
                      draggable={false}
                    />
                  </TransformComponent>
                </TransformWrapper>
              ) : (
                <div className="loading">Loading…</div>
              )}
            </div>
          </section>

          <aside className="side">
            <div className="badge">
              <div className="badgeLabel">Round</div>
              <div className="badgeLabel">Score</div>

              <div className="badgeValue">
                {Math.min(idx + 1, totalRounds)}/{totalRounds}
              </div>
              <div className="badgeValue">{displayScore}</div>
            </div>

            <div className="card">
              <div className="cardHeader">
                <div className="cardTitle">Make your call</div>
                {puzzle && (
                  <div className="cardMeta">
                    Date (UTC): <code className="mono">{puzzle.date}</code>
                  </div>
                )}
              </div>

              {/* Controls are stacked at the bottom of this card */}
              <div className="controlsBottom">
                <div className="choiceButtons bigChoiceButtons">
                  <button
                    type="button"
                    className={`choiceBtn ${
                      currentChoice === "real" ? "choiceBtnActive" : ""
                    }`}
                    onClick={() =>
                      current && setChoice(current.roundIndex, "real")
                    }
                    disabled={!current || isCurrentLocked}
                  >
                    Real
                  </button>

                  <button
                    type="button"
                    className={`choiceBtn ${
                      currentChoice === "ai" ? "choiceBtnActive" : ""
                    }`}
                    onClick={() =>
                      current && setChoice(current.roundIndex, "ai")
                    }
                    disabled={!current || isCurrentLocked}
                  >
                    AI
                  </button>
                </div>

                <div className="hintRow">
                  <div className="hint">
                    {isCurrentLocked
                      ? "Locked (you already moved past this round)."
                      : "Pick one to continue."}
                  </div>
                </div>

                {err && <div className="errorBox">{err}</div>}

                <div className="navRowSingle">
                  <button
                    type="button"
                    className="navBtn navBtnPrimary navBtnBig"
                    onClick={next}
                    disabled={
                      !current ||
                      submitting ||
                      !!(attempt && "ok" in attempt && attempt.ok)
                    }
                  >
                    {submitOrNextLabel}
                  </button>
                </div>

                {attempt && "ok" in attempt && attempt.ok && (
                  <div className="resultBox">
                    <div className="resultTitle">Result</div>
                    <div className="resultLine">
                      {attempt.alreadySubmitted
                        ? "Already submitted today."
                        : "Submitted."}
                    </div>
                    <div className="resultLine">
                      Score: <strong>{attempt.score}</strong> /{" "}
                      {attempt.totalRounds}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="devLine">
              API: <code className="mono">{apiBase}</code> · User:{" "}
              <code className="mono">{userId.slice(0, 8)}</code>
            </div>
          </aside>
        </main>
      </div>
    );
  }
}
