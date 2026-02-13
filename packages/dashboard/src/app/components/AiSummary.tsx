"use client";

import { useEffect, useState } from "react";

export function AiSummary({ range }: { range: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSummary(null);

    fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ range }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { summary?: string; error?: string };
        if (!res.ok || data.error) {
          setError(data.error ?? "Failed to generate summary");
        } else {
          setSummary(data.summary ?? null);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [range]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 mb-8">
        <p className="text-sm text-red-700">
          AI summary unavailable: {error}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 p-6 mb-8 text-white shadow-lg">
      <h2 className="text-sm font-medium text-indigo-100 uppercase tracking-wider mb-3">
        AI Summary
      </h2>
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-white/20 rounded w-full" />
          <div className="h-4 bg-white/20 rounded w-5/6" />
          <div className="h-4 bg-white/20 rounded w-4/6" />
        </div>
      ) : (
        <div className="prose prose-invert prose-sm max-w-none">
          {summary?.split("\n\n").map((paragraph, i) => (
            <p key={i} className="text-indigo-50 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
