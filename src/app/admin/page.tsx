"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCandidates, submitStationResults } from "@/lib/api-client";
import type { ApiCandidate } from "@/shared/types";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [candidates, setCandidates] = useState<ApiCandidate[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [rejectedVotes, setRejectedVotes] = useState<number>(0);
  const [disputedVotes, setDisputedVotes] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [submittedHistory, setSubmittedHistory] = useState<Array<{
    id: string;
    timestamp: string;
    totalVotes: number;
    station: string;
  }>>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function loadCandidates() {
      const data = await getCandidates();
      setCandidates(data);
      // Initialize votes
      const initial: Record<string, number> = {};
      data.forEach((c) => {
        initial[c.id] = 0;
      });
      setVotes(initial);
    }
    loadCandidates();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0d0e10] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f2a900] border-t-transparent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Loading Agent Session...</span>
        </div>
      </div>
    );
  }

  const agent = session?.user?.agentProfile;

  const totalValidVotes = Object.values(votes).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const totalVotesCast = totalValidVotes + (Number(rejectedVotes) || 0) + (Number(disputedVotes) || 0);

  const handleVoteChange = (candidateId: string, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setVotes((prev) => ({ ...prev, [candidateId]: num }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalValidVotes <= 0) {
      setSubmissionStatus({
        type: "error",
        message: "Please enter vote tallies before submitting Form 34A results."
      });
      return;
    }

    setIsSubmitting(true);
    setSubmissionStatus(null);

    const payload = {
      results: Object.entries(votes).map(([candidateId, count]) => ({
        candidate: candidateId,
        votes: count
      }))
    };

    const res = await submitStationResults(payload, session?.accessToken);

    setIsSubmitting(false);
    if (res.success) {
      setSubmissionStatus({
        type: "success",
        message: "Results successfully verified and submitted to the National Electoral Stream!"
      });
      setSubmittedHistory((prev) => [
        {
          id: `F34A-${Date.now().toString().slice(-6)}`,
          timestamp: new Date().toLocaleTimeString(),
          totalVotes: totalVotesCast,
          station: agent?.polling_station || "Primary Station"
        },
        ...prev
      ]);
    } else {
      setSubmissionStatus({
        type: "error",
        message: res.error || "Submission failed. Please check network connection."
      });
    }
  };

  return (
    <main className="min-h-dvh bg-[#0d0e10] pb-16 text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/70 px-4 py-3.5 backdrop-blur-2xl md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-white hover:opacity-90">
              <span className="h-6 w-6 rotate-[-7deg] rounded-[8px_12px_9px_13px] bg-green-500 shadow-inner" />
              <span className="hidden sm:inline">LINDA<span className="text-[#f2a900]">—</span>KURA</span>
            </a>
            <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">
              Field Agent Station
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
            >
              Public Live Feed ↗
            </a>
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
        {/* Agent Station Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-white/[0.05] via-white/[0.02] to-transparent p-6 backdrop-blur-xl shadow-2xl"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#f2a900]">
                  Assigned Polling Centre
                </span>
                <span className="rounded-md border border-[#f2a900]/30 bg-[#f2a900]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#f2a900]">
                  {agent?.access_code || "LK-AGENT"}
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
                {agent?.polling_station || "Official Polling Station"}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                <span className="font-semibold text-white/90">{agent?.county || "Kenya"}</span>
                <span>•</span>
                <span>{agent?.constituency}</span>
                <span>•</span>
                <span>Ward: {agent?.ward}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-start rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Agent Username</span>
                <span className="font-mono text-sm font-bold text-white">{agent?.username || "Authorized Agent"}</span>
              </div>
              <div className="flex flex-col items-start rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Stream Status</span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-green-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                  Live Sync Active
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Dashboard Grid */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Submission Form (2 Cols) */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-white/10 bg-black/50 p-6 backdrop-blur-xl md:p-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <h2 className="text-xl font-bold text-white">Form 34A Tally Submission</h2>
                  <p className="text-xs text-white/50">
                    Enter the officially verified presidential votes recorded at this polling stream.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs font-bold text-[#f2a900]">
                  Race: Presidential
                </span>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
                {/* Candidates tallies */}
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
                    Candidate Tallies
                  </span>

                  {candidates.map((cand) => (
                    <div
                      key={cand.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-4 w-4 shrink-0 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                          style={{ backgroundColor: cand.party_color || "#f2a900" }}
                        />
                        <div className="flex flex-col">
                          <span className="text-base font-bold text-white">{cand.full_name}</span>
                          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
                            {cand.party_name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label htmlFor={`cand-${cand.id}`} className="text-xs text-white/40 sm:hidden">
                          Votes:
                        </label>
                        <input
                          id={`cand-${cand.id}`}
                          type="number"
                          min="0"
                          value={votes[cand.id] ?? 0}
                          onChange={(e) => handleVoteChange(cand.id, e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/60 px-4 py-2 text-right font-mono text-lg font-bold tabular-nums text-white outline-none transition focus:border-[#f2a900] focus:ring-1 focus:ring-[#f2a900] sm:w-40"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Auxiliary Counts (Rejected / Disputed) */}
                <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                    <label htmlFor="rejected-votes" className="text-xs font-bold uppercase tracking-wider text-white/60">
                      Rejected Ballots
                    </label>
                    <input
                      id="rejected-votes"
                      type="number"
                      min="0"
                      value={rejectedVotes}
                      onChange={(e) => setRejectedVotes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="rounded-xl border border-white/10 bg-black/60 px-4 py-2 font-mono text-base font-bold text-white outline-none focus:border-red-400"
                    />
                  </div>

                  <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                    <label htmlFor="disputed-votes" className="text-xs font-bold uppercase tracking-wider text-white/60">
                      Disputed Ballots
                    </label>
                    <input
                      id="disputed-votes"
                      type="number"
                      min="0"
                      value={disputedVotes}
                      onChange={(e) => setDisputedVotes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="rounded-xl border border-white/10 bg-black/60 px-4 py-2 font-mono text-base font-bold text-white outline-none focus:border-[#f2a900]"
                    />
                  </div>
                </div>

                {/* Status Message */}
                <AnimatePresence>
                  {submissionStatus && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold ${
                        submissionStatus.type === "success"
                          ? "border-green-500/30 bg-green-500/10 text-green-300"
                          : "border-red-500/30 bg-red-500/10 text-red-300"
                      }`}
                    >
                      <span>{submissionStatus.type === "success" ? "✓" : "⚠️"}</span>
                      <span>{submissionStatus.message}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 via-emerald-500 to-[#f2a900] px-8 py-4 text-base font-black text-black shadow-[0_5px_30px_rgba(34,197,94,0.3)] transition hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      <span>Transmitting Form 34A to National Server...</span>
                    </div>
                  ) : (
                    <span>Transmit & Broadcast Polling Station Tally →</span>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Sidebar: Summary & Submissions History */}
          <div className="flex flex-col gap-6">
            {/* Live Tally Verification Card */}
            <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/50 p-6 backdrop-blur-xl">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
                Tally Stream Summary
              </span>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                  <span className="text-xs text-white/60">Total Valid Votes</span>
                  <span className="font-mono text-base font-bold tabular-nums text-white">
                    {totalValidVotes.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                  <span className="text-xs text-white/60">Rejected Ballots</span>
                  <span className="font-mono text-base font-bold tabular-nums text-red-400">
                    {rejectedVotes.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#f2a900]/30 bg-[#f2a900]/10 p-3">
                  <span className="text-xs font-bold text-[#f2a900]">Total Cast Votes</span>
                  <span className="font-mono text-lg font-black tabular-nums text-white">
                    {totalVotesCast.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Transmitted Records */}
            <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/50 p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
                  Recent Broadcasts
                </span>
                <span className="text-[10px] font-mono text-white/40">Audit Log</span>
              </div>

              {submittedHistory.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-white/40">
                  No submissions yet during this active session. Enter tally tallies on the left to transmit.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {submittedHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-2xl border border-green-500/20 bg-green-500/5 p-3"
                    >
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-bold text-white">{item.id}</span>
                        <span className="text-[10px] text-white/50">{item.timestamp}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-xs font-bold text-green-400">
                          {item.totalVotes.toLocaleString()} votes
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-green-500/80">Verified ✓</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
