import { useEffect, useMemo, useState } from "react";
import "./App.css";

type PuzzleRound = { roundIndex: number; imageUrl: string };
type PuzzleResponse = { date: string; rounds: PuzzleRound[]; error?: string };

type Choice = "real" | "ai";

type AttemptResponse =
  | {
      ok: true;
      alreadySubmitted: boolean;
      puzzleDate: string;
      score: number | null;
      totalRounds: number;
      createdAt?: string | null;
    }
  | {
      error: string;
      puzzleDate?: string;
      totalRounds?: number;
      answered?: number;
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

  // roundIndex -> choice
  const [answers, setAnswers] = useState<Record<number, Choice>>({});

  // current position in puzzle.rounds
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

        // Ensure consistent round ordering
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

  const totalRounds = puzzle?.rounds.length ?? 0;
  const current = puzzle?.rounds[idx] ?? null;
  const isLast = idx === totalRounds - 1;

  function setChoice(roundIndex: number, choice: Choice) {
    setAnswers((prev) => ({ ...prev, [roundIndex]: choice }));
  }

  async function submitAttempt() {
    if (!puzzle) return;

    // validate answered all rounds
    for (const r of puzzle.rounds) {
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
          puzzle.rounds.map((r) => [
            String(r.roundIndex),
            answers[r.roundIndex],
          ]),
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
        setErr("error" in json ? json.error : `Submit failed (${res.status})`);
        return;
      }

      setAttempt(json);

      // Load leaderboard after submit
      setLoadingLeaderboard(true);
      const lbRes = await fetch(`${apiBase}/api/leaderboard/today?limit=20`);
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

  function next() {
    if (!current) return;
    if (!answers[current.roundIndex]) {
      setErr("Please choose Real or AI to continue.");
      return;
    }
    setErr(null);
    setIdx((v) => Math.min(v + 1, totalRounds - 1));
  }

  function prev() {
    setErr(null);
    setIdx((v) => Math.max(v - 1, 0));
  }

  if (!apiBase) {
    return (
      <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
        <h1>Real or AI</h1>
        <p>
          Missing <code>VITE_API_BASE</code>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>Real or AI</h1>

      <p style={{ marginTop: 4 }}>
        API Base: <code>{apiBase}</code>
      </p>

      {err && (
        <div style={{ padding: 12, border: "1px solid #f99", marginTop: 16 }}>
          <strong>Error:</strong> {err}
        </div>
      )}

      {!puzzle ? (
        <p style={{ marginTop: 16 }}>Loading puzzle…</p>
      ) : (
        <>
          <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd" }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Daily Puzzle</div>
            <div style={{ marginTop: 4 }}>
              Date (UTC): <code>{puzzle.date}</code>
            </div>
            <div style={{ marginTop: 4 }}>
              Round: {idx + 1}/{totalRounds}
            </div>
          </div>

          {current && (
            <div
              style={{ marginTop: 18, padding: 12, border: "1px solid #ddd" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18 }}>
                  Round {current.roundIndex}
                </h2>
                <div>
                  Selected:{" "}
                  {answers[current.roundIndex] ? (
                    <strong>{answers[current.roundIndex].toUpperCase()}</strong>
                  ) : (
                    <span style={{ opacity: 0.7 }}>None</span>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <img
                  src={current.imageUrl}
                  alt={`Round ${current.roundIndex}`}
                  style={{
                    width: "100%",
                    maxHeight: 420,
                    objectFit: "cover",
                    border: "1px solid #444",
                  }}
                  loading="lazy"
                />
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setChoice(current.roundIndex, "real")}
                  style={{
                    padding: "10px 14px",
                    border:
                      answers[current.roundIndex] === "real"
                        ? "2px solid #e11d48"
                        : "1px solid #444",
                    background: "transparent",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Real
                </button>

                <button
                  type="button"
                  onClick={() => setChoice(current.roundIndex, "ai")}
                  style={{
                    padding: "10px 14px",
                    border:
                      answers[current.roundIndex] === "ai"
                        ? "2px solid #e11d48"
                        : "1px solid #444",
                    background: "transparent",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  AI
                </button>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={prev}
                  disabled={idx === 0 || submitting}
                  style={{
                    padding: "10px 14px",
                    border: "1px solid #444",
                    background: "#111",
                    color: "#fff",
                    cursor: idx === 0 || submitting ? "not-allowed" : "pointer",
                    opacity: idx === 0 ? 0.6 : 1,
                  }}
                >
                  Back
                </button>

                {!isLast ? (
                  <button
                    type="button"
                    onClick={next}
                    disabled={submitting}
                    style={{
                      padding: "10px 14px",
                      border: "1px solid #444",
                      background: "#111",
                      color: "#fff",
                      cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitAttempt}
                    disabled={submitting}
                    style={{
                      padding: "10px 14px",
                      border: "1px solid #444",
                      background: submitting ? "#222" : "#111",
                      color: "#fff",
                      cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                )}
              </div>
            </div>
          )}

          {attempt && "ok" in attempt && (
            <div
              style={{ marginTop: 18, padding: 12, border: "1px solid #ddd" }}
            >
              <h2 style={{ marginTop: 0 }}>Result</h2>
              <p style={{ marginTop: 6 }}>
                {attempt.alreadySubmitted
                  ? "Already submitted today."
                  : "Submitted."}
              </p>
              <p style={{ marginTop: 6 }}>
                Score: <strong>{attempt.score}</strong> / {attempt.totalRounds}
              </p>
            </div>
          )}

          <div style={{ marginTop: 18, padding: 12, border: "1px solid #ddd" }}>
            <h2 style={{ marginTop: 0 }}>Leaderboard (Today)</h2>
            {loadingLeaderboard && <p>Loading leaderboard…</p>}
            {!loadingLeaderboard &&
              leaderboard &&
              leaderboard.leaderboard.length === 0 && <p>No attempts yet.</p>}
            {!loadingLeaderboard &&
              leaderboard &&
              leaderboard.leaderboard.length > 0 && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {leaderboard.leaderboard.map((e) => (
                    <div key={e.rank} style={{ display: "flex", gap: 12 }}>
                      <div style={{ width: 36 }}>#{e.rank}</div>
                      <div style={{ width: 90 }}>
                        <code>{e.user}</code>
                      </div>
                      <div style={{ width: 60 }}>{e.score}</div>
                      <div style={{ opacity: 0.7 }}>{e.createdAt}</div>
                    </div>
                  ))}
                </div>
              )}
            {!loadingLeaderboard && !leaderboard && (
              <p>Submit an attempt to populate the leaderboard.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
