import { useEffect, useState } from "react";
import "./App.css";

type HealthResponse = {
  ok: boolean;
  tables?: { name: string }[];
  error?: string;
};

export default function App() {
  const apiBase = import.meta.env.VITE_API_BASE as string;
  const [data, setData] = useState<HealthResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const res = await fetch(`${apiBase}/api/health`, { method: "GET" });
        const json = (await res.json()) as HealthResponse;
        setData(json);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    }
    run();
  }, [apiBase]);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>Real or AI (Frontend)</h1>
      <p>
        API Base: <code>{apiBase}</code>
      </p>

      {err && (
        <div style={{ padding: 12, border: "1px solid #f99" }}>
          <strong>Error:</strong> {err}
        </div>
      )}

      {data ? (
        <pre
          style={{ padding: 12, border: "1px solid #ddd", overflow: "auto" }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <p>Loading…</p>
      )}
    </div>
  );
}
