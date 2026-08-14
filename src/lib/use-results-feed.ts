"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { mockResults } from "@/lib/results";
import type { ResultSummary } from "@/shared/types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function useResultsFeed() {
  const [results, setResults] = useState<ResultSummary>(mockResults);
  const [status, setStatus] = useState<"live" | "polling">("polling");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/results/summary`);
        if (response.ok && active) setResults(await response.json() as ResultSummary);
      } catch { /* Mock data remains visible when the local API is unavailable. */ }
    };
    void refresh();
    const interval = window.setInterval(refresh, 15_000);
    const socket = io(apiUrl, { transports: ["websocket", "polling"], reconnection: true, reconnectionAttempts: 3, timeout: 4_000 });
    socket.on("connect", () => setStatus("live"));
    socket.on("disconnect", () => setStatus("polling"));
    socket.on("connect_error", () => setStatus("polling"));
    socket.on("results:summary", (next: ResultSummary) => { if (active) setResults(next); });
    return () => { active = false; window.clearInterval(interval); socket.disconnect(); };
  }, []);
  return { results, status };
}
