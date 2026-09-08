"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface Candidate {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  party_name?: string;
  party_color?: string;
}

interface Constituency {
  id: string;
  name: string;
  code?: number;
  registered_voters?: number;
}

interface ResultRow {
  candidate: string;
  votes: number;
}

interface LogEntry {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  status: number | string;
  timestamp: string;
  durationMs: number;
  data: unknown;
  isError: boolean;
}

export default function ApiTestPage() {
  const [baseUrl, setBaseUrl] = useState("http://localhost:8000");
  const [token, setToken] = useState("");

  // Candidates state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Constituency search state
  const [searchQuery, setSearchQuery] = useState("");
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [searching, setSearching] = useState(false);

  // Submit results state
  const [resultRows, setResultRows] = useState<ResultRow[]>([
    { candidate: "cand-1-uda", votes: 154200 },
    { candidate: "cand-2-odm", votes: 142100 }
  ]);
  const [submitting, setSubmitting] = useState(false);

  // Response Logger state
  const [activeLog, setActiveLog] = useState<LogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load / Save localStorage config
  useEffect(() => {
    const savedUrl = localStorage.getItem("lk_test_base_url");
    const savedToken = localStorage.getItem("lk_test_jwt_token");
    if (savedUrl) setBaseUrl(savedUrl);
    if (savedToken) setToken(savedToken);
  }, []);

  const handleBaseUrlChange = (val: string) => {
    setBaseUrl(val);
    localStorage.setItem("lk_test_base_url", val);
  };

  const handleTokenChange = (val: string) => {
    setToken(val);
    localStorage.setItem("lk_test_jwt_token", val);
  };

  // Helper fetcher
  const executeRequest = async (
    method: "GET" | "POST",
    endpoint: string,
    body?: unknown
  ) => {
    const cleanBase = baseUrl.trim().replace(/\/+$/, "");
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const fullUrl = `${cleanBase}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (token.trim()) {
      headers["Authorization"] = `Bearer ${token.trim()}`;
    }

    const startTime = performance.now();

    try {
      const res = await fetch(fullUrl, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      const durationMs = Math.round(performance.now() - startTime);
      let data: unknown;

      try {
        data = await res.json();
      } catch {
        data = await res.text();
      }

      const log: LogEntry = {
        method,
        url: fullUrl,
        status: res.status,
        timestamp: new Date().toLocaleTimeString(),
        durationMs,
        data,
        isError: !res.ok
      };

      setActiveLog(log);
      return { ok: res.ok, status: res.status, data };
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMessage = err instanceof Error ? err.message : String(err);

      const log: LogEntry = {
        method,
        url: fullUrl,
        status: "NET_ERR",
        timestamp: new Date().toLocaleTimeString(),
        durationMs,
        data: {
          error: errorMessage,
          hint: "Check if the server is running, CORS is enabled, and Base URL is accessible."
        },
        isError: true
      };

      setActiveLog(log);
      return { ok: false, status: 0, data: null };
    }
  };

  // 1. Fetch Candidates
  const handleFetchCandidates = async () => {
    setLoadingCandidates(true);
    const res = await executeRequest("GET", "/api/elections/candidates/");
    setLoadingCandidates(false);

    if (res.ok && Array.isArray(res.data)) {
      setCandidates(res.data);
    }
  };

  // 2. Search Constituencies
  const handleSearchConstituencies = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    const endpoint = `/api/elections/constituencies/?search=${encodeURIComponent(
      searchQuery.trim()
    )}`;
    const res = await executeRequest("GET", endpoint);
    setSearching(false);

    if (res.ok && Array.isArray(res.data)) {
      setConstituencies(res.data);
    }
  };

  // 3. Submit Results
  const handleAddResultRow = (candidate = "", votes = 0) => {
    setResultRows((prev) => [...prev, { candidate, votes }]);
  };

  const handleRemoveResultRow = (index: number) => {
    setResultRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRow = (
    index: number,
    field: "candidate" | "votes",
    val: string | number
  ) => {
    setResultRows((prev) => {
      const updated = [...prev];
      if (field === "votes") {
        updated[index].votes = Math.max(0, parseInt(String(val), 10) || 0);
      } else {
        updated[index].candidate = String(val);
      }
      return updated;
    });
  };

  const handleSubmitResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resultRows.length === 0) {
      alert("Please add at least one candidate result.");
      return;
    }

    const payload = {
      results: resultRows.filter((r) => r.candidate.trim().length > 0)
    };

    setSubmitting(true);
    await executeRequest("POST", "/api/elections/results/submit/", payload);
    setSubmitting(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0c0d0f] text-gray-100 antialiased p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Navigation & Header */}
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-green-500 to-[#f2a900] font-bold text-black shadow-lg shadow-green-500/20"
            >
              LK
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  Lindakura Elections API
                </h1>
                <span className="rounded border border-[#f2a900]/30 bg-[#f2a900]/10 px-2 py-0.5 font-mono text-xs font-bold text-[#f2a900]">
                  Interactive Test Bench
                </span>
              </div>
              <p className="text-xs text-gray-400">
                In-browser Postman-like API client to test candidate retrieval, constituency queries, and Form 34A bulk submissions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-medium text-white/80 transition hover:bg-white/10"
            >
              Live Telemetry Feed ↗
            </Link>
            <Link
              href="/admin/login"
              className="rounded-xl bg-gradient-to-r from-green-500 to-[#f2a900] px-3.5 py-2 font-bold text-black transition hover:opacity-90"
            >
              Agent Login 🔑
            </Link>
          </div>
        </header>

        {/* Global Configuration Panel */}
        <section className="rounded-2xl border border-white/10 bg-[#14161a] p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f2a900]">
              <span className="h-2 w-2 rounded-full bg-[#f2a900]" />
              Global Target Server & Auth Headers
            </h2>
            <span className="text-[11px] text-gray-500">Auto-saved to localStorage</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="baseUrlInput" className="mb-1.5 block text-xs font-semibold text-gray-300">
                API Base URL
              </label>
              <input
                id="baseUrlInput"
                type="text"
                value={baseUrl}
                onChange={(e) => handleBaseUrlChange(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full rounded-xl border border-white/10 bg-[#0d0e10] px-3.5 py-2.5 font-mono text-sm text-white outline-none transition focus:border-[#f2a900]"
              />
              <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                <span>Presets:</span>
                <button
                  type="button"
                  onClick={() => handleBaseUrlChange("http://localhost:8000")}
                  className="underline hover:text-white"
                >
                  :8000 (Django)
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => handleBaseUrlChange("http://localhost:3001")}
                  className="underline hover:text-white"
                >
                  :3001 (Fastify Mock)
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="jwtInput" className="mb-1.5 block text-xs font-semibold text-gray-300">
                JWT Access Token (Optional for public endpoints)
              </label>
              <input
                id="jwtInput"
                type="text"
                value={token}
                onChange={(e) => handleTokenChange(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full truncate rounded-xl border border-white/10 bg-[#0d0e10] px-3.5 py-2.5 font-mono text-sm text-white outline-none transition focus:border-[#f2a900]"
              />
              <p className="mt-1 text-[11px] text-gray-500 font-mono">
                Header: Authorization: Bearer {token ? "••••••••" : "<none>"}
              </p>
            </div>
          </div>
        </section>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: 3 Feature Test Cards */}
          <div className="space-y-6 lg:col-span-7">
            {/* Feature 1: Candidate Retrieval */}
            <section className="rounded-2xl border border-white/10 bg-[#14161a] p-5 shadow-xl">
              <div className="flex flex-col justify-between gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-xs font-bold text-blue-400">
                      GET
                    </span>
                    <h3 className="text-base font-bold text-white">/api/elections/candidates/</h3>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Fetch all candidate records with party affiliation and UUIDs
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleFetchCandidates}
                  disabled={loadingCandidates}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 active:scale-95 disabled:opacity-50"
                >
                  {loadingCandidates ? "Fetching..." : "Fetch Candidates"}
                </button>
              </div>

              <div className="mt-4 max-h-60 overflow-x-auto overflow-y-auto">
                {candidates.length === 0 ? (
                  <p className="py-4 text-center text-xs italic text-gray-500">
                    Click &quot;Fetch Candidates&quot; to inspect records
                  </p>
                ) : (
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400">
                        <th className="px-3 py-2 font-semibold">Candidate</th>
                        <th className="px-3 py-2 font-semibold">Party</th>
                        <th className="px-3 py-2 font-semibold">Candidate ID / UUID</th>
                        <th className="px-3 py-2 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {candidates.map((c) => {
                        const name =
                          c.full_name || `${c.first_name || ""} ${c.last_name || ""}`;
                        return (
                          <tr key={c.id} className="transition hover:bg-white/[0.02]">
                            <td className="flex items-center gap-2 px-3 py-2.5 font-sans font-bold text-white">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: c.party_color || "#f2a900" }}
                              />
                              {name}
                            </td>
                            <td className="px-3 py-2.5 font-sans text-gray-300">
                              {c.party_name || "Independent"}
                            </td>
                            <td className="max-w-[140px] truncate px-3 py-2.5 text-gray-400">
                              {c.id}
                            </td>
                            <td className="space-x-1 px-3 py-2.5 text-right font-sans">
                              <button
                                type="button"
                                onClick={() => copyToClipboard(c.id)}
                                className="rounded bg-white/5 px-2 py-1 text-[11px] font-semibold text-[#f2a900] transition hover:bg-white/10"
                              >
                                {copiedId === c.id ? "✓ Copied" : "Copy ID"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddResultRow(c.id, 10000)}
                                className="rounded bg-green-500/10 px-2 py-1 text-[11px] font-semibold text-green-400 transition hover:bg-green-500/20"
                                title="Add directly to Submit Results form below"
                              >
                                + Use in POST
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* Feature 2: Constituency Search */}
            <section className="rounded-2xl border border-white/10 bg-[#14161a] p-5 shadow-xl">
              <div className="border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
                    GET
                  </span>
                  <h3 className="text-base font-bold text-white">/api/elections/constituencies/</h3>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Search electoral boundaries by name or numeric code
                </p>
              </div>

              <form onSubmit={handleSearchConstituencies} className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Changamwe, Starehe, Westlands..."
                  className="flex-1 rounded-xl border border-white/10 bg-[#0d0e10] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#f2a900]"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-green-600/20 transition hover:opacity-95 active:scale-95 disabled:opacity-50"
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </form>

              <div className="mt-4 max-h-48 space-y-2 overflow-y-auto">
                {constituencies.length === 0 ? (
                  <p className="py-2 text-center text-xs italic text-gray-500">
                    No search executed or results empty
                  </p>
                ) : (
                  constituencies.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0d0e10] p-3 transition hover:border-[#f2a900]/30"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 font-mono text-xs font-bold text-emerald-400">
                          #{c.code ?? "?"}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-white">{c.name}</h4>
                          <span className="font-mono text-xs text-gray-500">
                            Registered Voters: {c.registered_voters?.toLocaleString() ?? "N/A"}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-gray-400">{c.id}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Feature 3: Submit Results */}
            <section className="rounded-2xl border border-white/10 bg-[#14161a] p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-bold text-amber-400">
                      POST
                    </span>
                    <h3 className="text-base font-bold text-white">/api/elections/results/submit/</h3>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Bulk polling station vote tally submission schema
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddResultRow()}
                  className="rounded-lg border border-[#f2a900]/30 bg-[#f2a900]/10 px-3 py-1.5 text-xs font-semibold text-[#f2a900] transition hover:bg-[#f2a900]/20"
                >
                  + Add Row
                </button>
              </div>

              <form onSubmit={handleSubmitResults} className="mt-4 space-y-4">
                <div className="space-y-3">
                  {resultRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 items-center gap-2 rounded-xl border border-white/5 bg-[#0d0e10] p-3"
                    >
                      <div className="col-span-7">
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">
                          Candidate UUID / ID
                        </label>
                        <input
                          type="text"
                          value={row.candidate}
                          onChange={(e) => handleUpdateRow(idx, "candidate", e.target.value)}
                          placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                          className="w-full rounded-lg border border-white/10 bg-[#14161a] px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-[#f2a900]"
                          required
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">
                          Votes
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={row.votes}
                          onChange={(e) => handleUpdateRow(idx, "votes", e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-[#14161a] px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-[#f2a900]"
                          required
                        />
                      </div>
                      <div className="col-span-1 flex items-end justify-center pt-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveResultRow(idx)}
                          className="p-1 text-gray-500 transition hover:text-red-400"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="font-mono text-xs text-gray-400">
                    {resultRows.length} item{resultRows.length === 1 ? "" : "s"} in payload
                  </span>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#f2a900] to-amber-500 px-6 py-2.5 text-xs font-black text-black shadow-lg shadow-[#f2a900]/20 transition hover:opacity-95 active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? "Transmitting..." : "Submit Results Payload →"}
                  </button>
                </div>
              </form>
            </section>
          </div>

          {/* Right Column: Response Console / Inspector */}
          <div className="lg:col-span-5">
            <div className="sticky top-6 flex h-[650px] flex-col rounded-2xl border border-white/10 bg-[#070809] p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f2a900]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                    Live Response Inspector
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {activeLog && (
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold border ${
                        activeLog.isError
                          ? "border-red-500/30 bg-red-500/10 text-red-400"
                          : "border-green-500/30 bg-green-500/10 text-green-400"
                      }`}
                    >
                      {activeLog.status}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveLog(null)}
                    className="rounded px-2 py-1 text-[11px] text-gray-500 transition hover:bg-white/5 hover:text-gray-300"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Request Metas */}
              <div className="flex items-center justify-between truncate border-b border-white/5 py-2 font-mono text-xs text-gray-400">
                {activeLog ? (
                  <>
                    <span className="truncate">
                      <strong className={activeLog.method === "POST" ? "text-amber-400" : "text-blue-400"}>
                        {activeLog.method}
                      </strong>{" "}
                      {activeLog.url}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-500">
                      {activeLog.durationMs}ms
                    </span>
                  </>
                ) : (
                  <span>Awaiting request execution...</span>
                )}
              </div>

              {/* JSON Pre Output */}
              <div className="mt-2 flex-1 overflow-auto rounded-xl border border-white/5 bg-[#0d0e10] p-3.5 font-mono text-xs leading-relaxed text-emerald-400">
                <pre className="whitespace-pre-wrap">
                  {activeLog
                    ? typeof activeLog.data === "object"
                      ? JSON.stringify(activeLog.data, null, 2)
                      : String(activeLog.data)
                    : "// Output JSON response will appear here after clicking any test button"}
                </pre>
              </div>

              {/* Console Footer */}
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-gray-500">
                <span>Lindakura API Test Suite</span>
                <span className={activeLog?.isError ? "text-red-400" : "text-gray-400"}>
                  {activeLog ? (activeLog.isError ? "Status: Request Failed" : "Status: 200 OK") : "Status: Idle"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
