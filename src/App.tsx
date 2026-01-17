import { useEffect, useMemo, useState } from "react";
import "./App.css";

type PuzzleRound = { roundIndex: number; imageUrl: string };
type PuzzleResponse = { date: string; rounds: PuzzleRound[]; error?: string };

type Choice = "real" | "ai";

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
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setErr(null);
        const res = await fetch(`${apiBase}/api/puzzle/today`);
        const json = (await res.json()) as PuzzleResponse;
        if (!res.ok) {
          setPuzzle(null);
          setErr(json.error ?? `Failed to load puzzle (${res.status})`);
          return;
        }
        setPuzzle(json);
        setAnswers({});
        setSubmitted(false);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    }
    load();
  }, [apiBase]);

  const totalRounds = puzzle?.rounds.length ?? 0;
  const answeredCount = Object.keys(answers).length;

  function setChoice(roundIndex: number, choice: Choice) {
    setAnswers((prev) => ({ ...prev, [roundIndex]: choice }));
  }

  function onSubmit() {
    if (!puzzle) return;
    if (answeredCount !== totalRounds) {
      setErr(`Please answer all rounds (${answeredCount}/${totalRounds}).`);
      return;
    }
    setErr(null);
    setSubmitted(true);

    // Next step: POST /api/attempt with userId, puzzle.date, answers
    console.log("Attempt", { userId, date: puzzle.date, answers });
  }

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: 16 }}>
      <h1>Real or AI</h1>
      <p>
        API Base: <code>{apiBase}</code>
      </p>
      <p>
        User: <code>{userId}</code>
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
              Progress: {answeredCount}/{totalRounds}
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              flexDirection: "column",
              gap: 22,
            }}
          >
            {puzzle.rounds.map((r) => {
              const choice = answers[r.roundIndex];
              return (
                <div
                  key={r.roundIndex}
                  style={{ padding: 12, border: "1px solid #ddd" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                    }}
                  >
                    <h2 style={{ margin: 0, fontSize: 18 }}>
                      Round {r.roundIndex}
                    </h2>
                    <div>
                      Selected:{" "}
                      {choice ? (
                        <strong>{choice.toUpperCase()}</strong>
                      ) : (
                        <span style={{ opacity: 0.7 }}>None</span>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <img
                      src={r.imageUrl}
                      alt={`Round ${r.roundIndex}`}
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
                      onClick={() => setChoice(r.roundIndex, "real")}
                      style={{
                        padding: "10px 14px",
                        border:
                          choice === "real"
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
                      onClick={() => setChoice(r.roundIndex, "ai")}
                      style={{
                        padding: "10px 14px",
                        border:
                          choice === "ai"
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
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <button
              onClick={onSubmit}
              disabled={!puzzle || submitted}
              style={{
                padding: "10px 16px",
                border: "1px solid #444",
                background: submitted ? "#222" : "#111",
                color: "#fff",
                cursor: submitted ? "not-allowed" : "pointer",
              }}
            >
              {submitted ? "Submitted" : "Submit"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
