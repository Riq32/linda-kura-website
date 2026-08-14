"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ResultSummary } from "@/shared/types";

const modes = ["Results", "Turnout", "History"];
const number = new Intl.NumberFormat("en-KE");

export function ResultsPanel({ location, results }: { location: string; results: ResultSummary }) {
  const [mode, setMode] = useState("Results");
  const maxVotes = Math.max(...results.candidates.map(candidate => candidate.votes));
  useEffect(() => setMode("Results"), [results.race]);
  return <motion.aside layout transition={{ type: "spring", stiffness: 290, damping: 28 }} className="min-w-0 rounded-panel bg-panel p-4 shadow-elevation md:p-6" aria-label="Results panel">
    <div className="mb-5 flex items-start justify-between gap-3"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.13em] text-gold">{location}</p><h1 className="font-display text-xl font-semibold tracking-tight text-ink">{results.race} race</h1><p className="mt-1 text-xs text-dim">Mock local data · {results.reportingPercent}% reporting</p></div><span className="rounded-continuous bg-kenya-green/20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8ed2aa]">{results.provenance}</span></div>
    <div className="mb-5 grid grid-cols-3 gap-1 rounded-continuous bg-white/[.07] p-1" aria-label="Result display mode">{modes.map(item => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)} className="rounded-xl px-2 py-2 text-[11px] font-semibold text-dim transition duration-300 ease-spring aria-pressed:bg-white/[.12] aria-pressed:text-ink active:scale-[.98]">{item}</button>)}</div>
    {mode === "Results" && <section className="border-t border-white/[.08] py-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-ink">{results.race}</h2><span className="text-[11px] text-dim">{results.candidates.length} candidates</span></div>{results.candidates.map(candidate => <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-2" key={candidate.id}><span className="truncate text-xs font-semibold text-ink">{candidate.name} <small className="font-normal text-dim">{candidate.party}</small></span><span className="text-xs tabular-nums text-ink">{number.format(candidate.votes)}</span><span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/[.08]"><motion.i initial={false} animate={{ width: `${candidate.votes / maxVotes * 100}%` }} transition={{ type: "spring", stiffness: 180, damping: 24 }} className={`block h-full rounded-full ${candidate.color === "green" ? "bg-kenya-green" : candidate.color === "gold" ? "bg-gold" : "bg-kenya-red"}`} /></span></div>)}</section>}
    {mode !== "History" && <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 border-t border-white/[.08] pt-4"><span className="text-xs text-dim">Voter turnout</span><strong className="text-sm tabular-nums text-ink">{results.turnoutPercent}%</strong><span className="col-span-2 h-1 rounded-full" style={{ background: `linear-gradient(90deg, var(--kenya-green) 0 ${results.turnoutPercent}%, rgba(238,243,239,.11) ${results.turnoutPercent}% 100%)` }} /></div>}
    {mode === "History" && <section className="border-t border-white/[.08] py-4 text-xs leading-relaxed text-dim"><h2 className="mb-1 text-sm font-bold text-ink">Historical comparison</h2><p>Historical mock data will appear here when a demonstration comparison is added.</p></section>}
    <div className="mt-4 flex items-center gap-2 border-t border-white/[.08] pt-4 text-[11px] text-dim"><span className="grid h-[18px] w-[18px] place-items-center rounded-lg bg-gold/20 font-bold text-gold">✓</span><span><b className="font-semibold text-ink">{results.provenance}</b> · simulated local tally</span></div>
  </motion.aside>;
}
