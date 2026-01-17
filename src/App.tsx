import { useEffect, useMemo, useState } from "react";
import "./App.css";

type PuzzleResponse = {
  date: string;
  rounds: Record<string, string[]>;
  error?: string;
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

  // roundIndex -> chosen image URL
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setErr(null);
        const res = await fetch(`${apiBase}/api/puzzle/today`, {
          method: "GET",
        });
        const json = (await res.json()) as PuzzleResponse;

        if (!res.ok) {
          setPuzzle(null);
          setErr(json?.error ?? `Failed to load puzzle (${res.status})`);
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

  const roundEntries = puzzle
    ? Object.entries(puzzle.rounds).sort((a, b) => Number(a[0]) - Number(b[0]))
    : [];
  const totalRounds = roundEntries.length;
  const answeredCount = Object.keys(answers).length;

  function choose(round: string, imageUrl: string) {
    setAnswers((prev) => ({ ...prev, [round]: imageUrl }));
  }

  function onSubmit() {
    if (!puzzle) return;
    if (answeredCount !== totalRounds) {
      setErr(
        `Please answer all rounds (${answeredCount}/${totalRounds} selected).`,
      );
      return;
    }
    setErr(null);
    setSubmitted(true);

    // Next step: we will POST to /api/attempt with X-User-Id and answers,
    // and show score + leaderboard.
    console.log("Submitting attempt", {
      userId,
      puzzleDate: puzzle.date,
      answers,
    });
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <h1>Real or AI</h1>

      <p style={{ marginTop: 4 }}>
        API Base: <code>{apiBase}</code>
      </p>
      <p style={{ marginTop: 4 }}>
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
            {roundEntries.map(([round, images]) => (
              <div
                key={round}
                style={{ padding: 12, border: "1px solid #ddd" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: 18 }}>Round {round}</h2>
                  <div>
                    Selected:{" "}
                    {answers[round] ? (
                      <span style={{ fontWeight: 600 }}>Yes</span>
                    ) : (
                      <span style={{ opacity: 0.7 }}>No</span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  {images.map((imgUrl) => {
                    const selected = answers[round] === imgUrl;
                    return (
                      <button
                        key={imgUrl}
                        type="button"
                        onClick={() => choose(round, imgUrl)}
                        style={{
                          padding: 0,
                          border: selected
                            ? "3px solid #e11d48"
                            : "1px solid #444",
                          background: "transparent",
                          cursor: "pointer",
                        }}
                        aria-label={`Select image for round ${round}`}
                      >
                        <img
                          src={imgUrl}
                          alt={`Round ${round}`}
                          style={{
                            display: "block",
                            width: "100%",
                            height: 220,
                            objectFit: "cover",
                          }}
                          loading="lazy"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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

            {submitted && (
              <div style={{ opacity: 0.85 }}>
                Submitted locally. Next step is server-side scoring.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
