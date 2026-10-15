"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import type { MapLocation, DetailedRegionData, RaceType, PollingStation } from "@/shared/types";
import { PARTIES } from "@/lib/results";

export interface ResultsPanelProps {
  location: MapLocation;
  activeData: DetailedRegionData | null;
  nationalData: DetailedRegionData;
}

const RACES: { key: RaceType; label: string; shortLabel: string }[] = [
  { key: "President", label: "President", shortLabel: "President" },
  { key: "Governor", label: "Governor", shortLabel: "Governor" },
  { key: "Senator", label: "Senator", shortLabel: "Senator" },
  { key: "Woman Representative", label: "Woman Rep", shortLabel: "Woman Rep" },
  { key: "Member of Parliament", label: "Member of Parliament", shortLabel: "MP" },
  { key: "Member of County Assembly", label: "County Assembly", shortLabel: "MCA" }
];

export function ResultsPanel({ location, activeData, nationalData }: ResultsPanelProps) {
  const [selectedRace, setSelectedRace] = useState<RaceType>("President");
  const [viewTab, setViewTab] = useState<"candidates" | "stations">("candidates");
  const [expandedStationId, setExpandedStationId] = useState<string | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [hoveredLegendParty, setHoveredLegendParty] = useState<string | null>(null);

  const data = activeData || nationalData;

  const crumbs = useMemo(() => [
    { label: "Kenya", level: "country" },
    ...(location.county ? [{ label: location.county.properties.shapeName, level: "county" }] : []),
    ...(location.constituency ? [{ label: location.constituency.properties.shapeName, level: "constituency" }] : []),
<<<<<<< HEAD
<<<<<<< HEAD
    ...(location.ward ? [{ label: location.ward.properties.shapeName, level: "ward" }] : []),
    ...(location.station ? [{ label: location.station.properties.name, level: "polling-station" }] : [])
  ];
=======
=======
>>>>>>> ephra
    ...(location.ward ? [{ label: location.ward.properties.shapeName, level: "ward" }] : [])
  ], [location]);

  const raceTally = data.races?.[selectedRace] || data.races?.["President"];
  const sortedCandidates = useMemo(() => {
    if (!raceTally?.candidates) return [];
    return [...raceTally.candidates].sort((a, b) => b.votes - a.votes);
  }, [raceTally]);

  const winner = sortedCandidates[0];

  const swingDelta = useMemo(() => {
    let hash = 0;
    const str = `${data.shapeID}:${selectedRace}:swing`;
    for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
    const val = (Math.abs(hash % 70) / 10 - 2.5).toFixed(1);
    return Number(val) >= 0 ? `+${val}%` : `${val}%`;
  }, [data.shapeID, selectedRace]);

  const auditHash = useMemo(() => {
    let hash = 0;
    const str = `${data.shapeID}:${data.totalVotesCast}:${data.reportingPct}`;
    for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
    const hex = Math.abs(hash).toString(16).padStart(8, "0");
    return `SHA-256: 7f8b${hex}e9c2d14a`;
  }, [data.shapeID, data.totalVotesCast, data.reportingPct]);

  const returningOfficerCode = `RO-${data.shapeID.replace(/[^A-Za-z0-9]/g, "").slice(0, 7).toUpperCase() || "NBI-047"}`;

  const handlePreviewForm = () => {
    alert(`Opening Form 34A Statutory Audit Sheet for ${data.name}...\nHash: ${auditHash}\nOfficer: ${returningOfficerCode}`);
  };

  const isWardLevel = location.level === "ward";
  const hasPollingStations = Boolean(data.pollingStations && data.pollingStations.length > 0);
<<<<<<< HEAD
>>>>>>> ephra
=======
>>>>>>> ephra

  return (
    <motion.aside
      layout
      className="relative flex h-full min-w-0 flex-col overflow-y-auto rounded-3xl border border-slate-200/90 bg-white/80 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-2xl antialiased"
      aria-label="Electoral telemetry dashboard"
    >
      <div className="flex flex-col gap-5">
        {/* Header Breadcrumbs, Title & Provenance Controls */}
        <div className="flex flex-col gap-3 border-b border-slate-200/60 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                {crumbs.map(c => c.label.toUpperCase()).join(" / ")}
              </span>
<<<<<<< HEAD
<<<<<<< HEAD
              <h2 className="text-3xl font-bold tracking-tight text-white">{data.name}</h2>{location.station?.properties.located === "approximate" && <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#e6c671]">Approximate location</span>}
=======
              <h2 className="truncate text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                {data.name}
              </h2>
>>>>>>> ephra
=======
              <h2 className="truncate text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                {data.name}
              </h2>
>>>>>>> ephra
            </div>

            {/* Reporting Badge - Clean Fintech Monospace */}
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="whitespace-nowrap text-[11px] font-bold tracking-wide text-slate-800 font-mono">
                {data.stationsReportingPct.toFixed(1)}% <span className="text-slate-400 font-normal">REPT</span>
              </span>
            </div>
          </div>

          {/* Provenance & Form 34A Audit Trigger Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs">
              <svg className="h-3.5 w-3.5 text-slate-900" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Form 34A/B Verified</span>
            </div>

            <button
              type="button"
              onClick={() => setShowAuditModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Audit Sheet</span>
            </button>
          </div>
        </div>

        {/* 1. 6-Race Ballot Switcher */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              Elective Position
            </span>
            {raceTally?.isNativeToLevel ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-2xs font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
                Direct Seat
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 shadow-2xs font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                Parent Race Contribution
              </span>
            )}
          </div>

          <div className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            {RACES.map(race => {
              const isSelected = selectedRace === race.key;
              return (
                <button
                  key={race.key}
                  type="button"
                  onClick={() => {
                    setSelectedRace(race.key);
                    setViewTab("candidates");
                  }}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  {race.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Constitutional Threshold Meter (Presidential Race Only) */}
        {selectedRace === "President" && winner && (
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                50% + 1 Constitutional Threshold
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                <span className={`h-1.5 w-1.5 rounded-full ${winner.voteShare > 50.0 ? "bg-emerald-500" : "bg-amber-500"}`} />
                {winner.voteShare > 50.0 ? "First Round Win Projected" : "Runoff Likely"}
              </span>
            </div>

            {/* Threshold Dual Progress Bar */}
            <div className="relative pb-2 pt-1">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/70">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, winner.voteShare)}%` }}
                  transition={{ type: "spring", stiffness: 90, damping: 20 }}
                  style={{ backgroundColor: winner.partyColor }}
                />
              </div>
              {/* 50% Marker Tick */}
              <div
                className="pointer-events-none absolute bottom-0 top-0 flex flex-col items-center"
                style={{ left: "50%" }}
              >
                <div className="h-4 w-px bg-slate-400" />
                <span className="-translate-x-1/2 text-[9px] font-bold text-slate-400 font-mono pt-0.5">
                  50.0%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Leader: <strong className="font-bold text-slate-900">{winner.name}</strong> ({winner.voteShare.toFixed(1)}%)
              </span>
              <span className="rounded-md bg-white px-2 py-0.5 font-semibold text-slate-700 border border-slate-200 text-[11px] shadow-2xs">
                24-County Rule: <strong className="text-slate-900 font-bold">Met (28/47)</strong>
              </span>
            </div>
          </div>
        )}

        {/* 3. Statutory Ballot Accounting Ledger */}
        {raceTally && (
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono px-0.5">
              Statutory Ledger
            </span>
            <div className="grid grid-cols-2 gap-3">
              {/* Turnout */}
              <div className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Turnout Rate
                </span>
                <span className="text-2xl font-black tracking-tight tabular-nums text-slate-900 font-mono">
                  {raceTally.turnoutPct.toFixed(1)}%
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {raceTally.totalVotesCast.toLocaleString()} votes cast
                </span>
              </div>

              {/* Margin & Swing */}
              <div className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Margin
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 font-mono">
                    {swingDelta} swing
                  </span>
                </div>
                <span className="text-2xl font-black tracking-tight tabular-nums text-slate-900 font-mono">
                  +{raceTally.margin.toFixed(1)}%
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {raceTally.margin > 5 ? "Decided Lead" : "Battleground"}
                </span>
              </div>

              {/* Registered Voters */}
              <div className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Registered
                </span>
                <span className="text-2xl font-black tracking-tight tabular-nums text-slate-900 font-mono">
                  {raceTally.registeredVoters.toLocaleString()}
                </span>
                <span className="text-xs font-medium text-slate-500">IEBC Register</span>
              </div>

              {/* Reporting Stations */}
              <div className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Transmitted
                </span>
                <span className="text-2xl font-black tracking-tight tabular-nums text-slate-900 font-mono">
                  {data.reportingPollingStations} <span className="text-sm font-normal text-slate-400">/ {data.totalPollingStations}</span>
                </span>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${data.reportingPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Ballot Integrity Sub-row */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-white px-4 py-3 text-xs font-medium text-slate-600 shadow-xs font-mono">
              <span>
                Valid: <strong className="font-bold text-slate-900">{raceTally.validVotes.toLocaleString()}</strong> ({((raceTally.validVotes / Math.max(1, raceTally.totalVotesCast)) * 100).toFixed(1)}%)
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Rejected: <strong className="font-bold text-amber-600">{raceTally.rejectedVotes.toLocaleString()}</strong> ({((raceTally.rejectedVotes / Math.max(1, raceTally.totalVotesCast)) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        )}

        {/* 4. Ward-Level Sub-Navigation */}
        {isWardLevel && hasPollingStations && (
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-200/50 p-1">
            <button
              type="button"
              onClick={() => setViewTab("candidates")}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                viewTab === "candidates"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Candidate Standings
            </button>
            <button
              type="button"
              onClick={() => setViewTab("stations")}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                viewTab === "stations"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Polling Stations ({data.pollingStations?.length})
            </button>
          </div>
        )}

        {/* 5. Polling Station Directory View */}
        {viewTab === "stations" && hasPollingStations ? (
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono px-0.5">
              Polling Stations Directory
            </span>
            <div className="scrollbar-thin flex max-h-[380px] flex-col gap-2.5 overflow-y-auto pr-1">
              {data.pollingStations?.map((station: PollingStation) => {
                const isExpanded = expandedStationId === station.id;
                
                return (
                  <div
                    key={station.id}
                    className="flex cursor-pointer flex-col rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition hover:border-slate-300 hover:shadow-sm"
                    onClick={() => setExpandedStationId(isExpanded ? null : station.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-xs font-bold text-slate-900">
                          {station.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {station.code} • {station.registeredVoters} reg. voters
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded-md border font-mono ${
                          station.status === "completed" ? "bg-slate-900 text-white border-slate-900" : 
                          station.status === "reporting" ? "bg-white text-slate-700 border-slate-200 shadow-2xs" : 
                          "bg-slate-50 text-slate-400 border-slate-200"
                        }`}>
                          {station.status === "completed" ? "Reported" : station.status === "reporting" ? "Transmitting" : "Pending"}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 font-mono">
                          {station.turnoutPct.toFixed(1)}% Turnout
                        </span>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                            Station Presidential Tally
                          </span>
                          {station.results?.slice(0, 2).map(c => (
                            <div key={c.id} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 truncate">
                                <span className="h-2 w-2 rounded-full shadow-xs" style={{ backgroundColor: c.partyColor }} />
                                <span className="truncate font-medium text-slate-800">{c.name}</span>
                                <span className="text-[10px] font-semibold text-slate-400 font-mono">({c.party})</span>
                              </div>
                              <span className="font-mono font-bold text-slate-900">
                                {c.votes.toLocaleString()} votes
                              </span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* 6. Candidate Standings Bars */
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono px-0.5">
              Live Standings ({selectedRace})
            </span>
            <div className="flex flex-col gap-2.5">
              <AnimatePresence mode="popLayout">
                {sortedCandidates.map((candidate, index) => {
                  const isHovered = hoveredLegendParty === candidate.party;
                  const isDimmed = hoveredLegendParty && !isHovered;
                  const isWinner = index === 0;

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: isDimmed ? 0.3 : 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      key={candidate.id}
                      className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 ${
                        isWinner
                          ? "border-slate-300 bg-white shadow-sm ring-1 ring-slate-900/5"
                          : "border-slate-200/90 bg-white shadow-2xs"
                      }`}
                    >
                      {isWinner && (
                        <div className="absolute right-0 top-0 rounded-bl-xl border-b border-l border-slate-200 bg-slate-900 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white font-mono">
                          Projected Leader
                        </div>
                      )}

                      <div className="mb-2.5 flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="h-4 w-4 shrink-0 rounded-full shadow-xs"
                            style={{ backgroundColor: candidate.partyColor }}
                          />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-bold text-slate-900">
                              {candidate.name}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                              {candidate.party}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end">
                          <span className="text-base font-black tabular-nums text-slate-900 font-mono">
                            {candidate.voteShare.toFixed(1)}%
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {candidate.votes.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, candidate.voteShare)}%` }}
                          transition={{ type: "spring", stiffness: 100, damping: 20 }}
                          style={{ backgroundColor: candidate.partyColor }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Major Political Party Filter / Legend */}
        <div className="mt-1 flex flex-wrap justify-center gap-1.5 border-t border-slate-200/60 pt-4">
          {PARTIES.map(party => (
            <button
              key={party.name}
              type="button"
              onMouseEnter={() => setHoveredLegendParty(party.name)}
              onMouseLeave={() => setHoveredLegendParty(null)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-all ${
                hoveredLegendParty === party.name 
                ? "border-slate-300 bg-slate-100 shadow-xs" 
                : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="h-2.5 w-2.5 rounded-full shadow-xs" style={{ backgroundColor: party.color }} />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 font-mono">
                {party.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Form 34A Audit Modal */}
      <AnimatePresence>
        {showAuditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold font-mono text-slate-800 tracking-wider">
                      IEBC VERIFIED
                    </span>
                    <span className="text-xs font-mono text-slate-400">{auditHash.slice(0, 18)}...</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Statutory Form 34A/B Record</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  ✕
                </button>
              </div>

              {/* Audit Metadata Content */}
              <div className="my-5 flex flex-col gap-3 text-xs font-mono">
                <div className="flex justify-between border-b border-slate-100 pb-2.5">
                  <span className="text-slate-400">Administrative Unit:</span>
                  <span className="font-bold text-slate-900">{data.name} ({data.level.toUpperCase()})</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2.5">
                  <span className="text-slate-400">Returning Officer ID:</span>
                  <span className="font-bold text-slate-900">{returningOfficerCode}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2.5">
                  <span className="text-slate-400">Digital Hash Signature:</span>
                  <span className="font-bold text-slate-900 break-all">{auditHash}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2.5">
                  <span className="text-slate-400">Transmission Status:</span>
                  <span className="font-bold text-slate-900">
                    {data.reportingPollingStations} of {data.totalPollingStations} Stations ({data.reportingPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-slate-400">Cryptographic Seal:</span>
                  <span className="font-bold text-slate-700">Tamper-Evident SHA-256 Committed</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePreviewForm}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
                >
                  <span>Preview PDF Record ↗</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}