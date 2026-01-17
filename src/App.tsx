import { useEffect, useMemo, useState } from "react";
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

type LeaderboardEntry = {
  rank: number;
  user: string;
  score: number;
  createdAt: string;
};
type LeaderboardResponse = {
  puzzleDate: string;
  leaderboard: LeaderboardEntry[];
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

export default function App() {
  const apiBase = import.meta.env.VITE_API_BASE as string;
  const userId = useMemo(() => ensureUserId(), []);

  const [puzzle, setPuzzle] = useState<PuzzleResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<number, Choice>>({});
  const [idx, setIdx] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState<AttemptResponse | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(
    null,
  );
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setErr(null);
        setAttempt(null);
        setLeaderboard(null);

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
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    }
    load();
  }, [apiBase]);

  const rounds = puzzle?.rounds ?? [];
  const totalRounds = rounds.length || 5;
  const current = rounds[idx] ?? null;
  const isLast = idx === rounds.length - 1;

  const currentChoice = current ? answers[current.roundIndex] : undefined;

  const displayScore =
    attempt &&
    "ok" in attempt &&
    attempt.ok &&
    typeof attempt.score === "number"
      ? attempt.score
      : 0;

  function setChoice(roundIndex: number, choice: Choice) {
    setAnswers((prev) => ({ ...prev, [roundIndex]: choice }));
  }

  function prev() {
    setErr(null);
    setIdx((v) => Math.max(v - 1, 0));
  }

  function next() {
    if (!current) return;
    if (!answers[current.roundIndex]) {
      setErr("Choose Real or AI to continue.");
      return;
    }
    setErr(null);
    setIdx((v) => Math.min(v + 1, rounds.length - 1));
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

      setLoadingLeaderboard(true);
      const lbRes = await fetch(`${apiBase}/api/leaderboard/today?limit=10`);
      const lbJson = (await lbRes.json()) as LeaderboardResponse;
      if (lbRes.ok) setLeaderboard(lbJson);
      setLoadingLeaderboard(false);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setAttempt(null);
      setLoadingLeaderboard(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">REALORAI</div>
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
          <div className="stageInner">
            {current ? (
              <img
                className="stageImg"
                src={current.imageUrl}
                alt={`Round ${current.roundIndex}`}
                loading="eager"
              />
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

            <div className="choiceRow">
              <button
                type="button"
                className={`choiceBtn ${currentChoice === "real" ? "choiceBtnActive" : ""}`}
                onClick={() => current && setChoice(current.roundIndex, "real")}
              >
                Real
              </button>

              <button
                type="button"
                className={`choiceBtn ${currentChoice === "ai" ? "choiceBtnActive" : ""}`}
                onClick={() => current && setChoice(current.roundIndex, "ai")}
              >
                AI
              </button>
            </div>

            {err && <div className="errorBox">{err}</div>}

            <div className="navRow">
              <button
                type="button"
                className="navBtn"
                onClick={prev}
                disabled={idx === 0 || submitting}
              >
                Back
              </button>

              {!isLast ? (
                <button
                  type="button"
                  className="navBtn"
                  onClick={next}
                  disabled={submitting}
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  className="navBtn navBtnPrimary"
                  onClick={submitAttempt}
                  disabled={submitting}
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              )}
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

          <div className="card cardTall">
            <div className="cardTitle">Leaderboard (Today)</div>

            {loadingLeaderboard && <div className="muted">Loading…</div>}

            {!loadingLeaderboard &&
              leaderboard &&
              leaderboard.leaderboard.length === 0 && (
                <div className="muted">No attempts yet.</div>
              )}

            {!loadingLeaderboard &&
              leaderboard &&
              leaderboard.leaderboard.length > 0 && (
                <div className="lbList">
                  {leaderboard.leaderboard.map((e) => (
                    <div key={e.rank} className="lbRow">
                      <div className="lbRank">#{e.rank}</div>
                      <div className="lbUser mono">{e.user}</div>
                      <div className="lbScore">{e.score}</div>
                    </div>
                  ))}
                </div>
              )}

            {!loadingLeaderboard && !leaderboard && (
              <div className="muted">
                Submit an attempt to populate the leaderboard.
              </div>
            )}
          </div>

          <div className="devLine">
            API: <code className="mono">{apiBase}</code> · User:{" "}
            <code className="mono">{userId.slice(0, 8)}</code>
          </div>
        </aside>
      </main>

      <footer className="footer">Advertisement</footer>
    </div>
  );
}
