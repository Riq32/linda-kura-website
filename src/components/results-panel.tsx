"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import type { MapLocation, RegionElectionData } from "@/shared/types";
import { PARTIES } from "@/lib/results";

export interface ResultsPanelProps {
  location: MapLocation;
  activeData: RegionElectionData | null;
  nationalData: RegionElectionData;
}

export function ResultsPanel({ location, activeData, nationalData }: ResultsPanelProps) {
  const [hoveredLegendParty, setHoveredLegendParty] = useState<string | null>(null);
  
  const data = activeData || nationalData;

  const crumbs = [
    { label: "Kenya", level: "country" },
    ...(location.county ? [{ label: location.county.properties.shapeName, level: "county" }] : []),
    ...(location.constituency ? [{ label: location.constituency.properties.shapeName, level: "constituency" }] : []),
    ...(location.ward ? [{ label: location.ward.properties.shapeName, level: "ward" }] : [])
  ];

  return (
    <motion.aside 
      layout 
      className="flex h-full min-w-0 flex-col overflow-y-auto rounded-2xl border border-white/10 bg-black/70 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl" 
      aria-label="Telemetry dashboard"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 border-b border-white/10 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                {crumbs.map(c => c.label.toUpperCase()).join(' > ')}
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-white">{data.name}</h2>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-green-400">
                {data.stationsReportingPct.toFixed(1)}% REPT
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pb-2">
          <div className="flex flex-col gap-1 rounded-xl bg-white/5 p-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Turnout Rate</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-white">{data.turnoutPct.toFixed(1)}%</span>
            </div>
            <span className="text-xs font-mono text-white/40">{data.totalVotesCast.toLocaleString()} votes</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-white/5 p-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Margin</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-white">+{data.margin.toFixed(1)}%</span>
            </div>
            <span className="text-xs text-white/40">{data.margin > 5 ? "Decided" : "Too Close to Call"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Live Results</span>
          <div className="flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
              {data.partyBreakdown.map((party, index) => {
                const isHovered = hoveredLegendParty === party.party;
                const isDimmed = hoveredLegendParty && !isHovered;
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: isDimmed ? 0.3 : 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    key={party.party} 
                    className={`relative overflow-hidden rounded-xl border p-4 transition-opacity duration-200 ${index === 0 ? 'border-[#e6c671]/40 bg-[#e6c671]/5' : 'border-white/5 bg-white/5'}`}
                  >
                    {index === 0 && (
                      <div className="absolute right-0 top-0 rounded-bl-lg bg-[#e6c671]/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[#e6c671]">Projected Winner</div>
                    )}
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-4 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: party.color }} />
                        <div className="flex flex-col">
                          <span className="text-base font-bold text-white">{party.candidate}</span>
                          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">{party.party}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-base font-bold tabular-nums text-white">{party.percentage.toFixed(1)}%</span>
                        <span className="text-[11px] font-mono text-white/50">{party.votes.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
                      <motion.div 
                        className="h-full rounded-full" 
                        initial={{ width: 0 }}
                        animate={{ width: `${party.percentage}%` }}
                        transition={{ type: "spring", stiffness: 100, damping: 20 }}
                        style={{ backgroundColor: party.color }} 
                      />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-white/10 pt-5">
          {PARTIES.map(party => (
            <button
              key={party.name}
              type="button"
              onMouseEnter={() => setHoveredLegendParty(party.name)}
              onMouseLeave={() => setHoveredLegendParty(null)}
              className={`flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition-colors hover:bg-white/10 ${hoveredLegendParty === party.name ? 'ring-1 ring-white/30' : ''}`}
            >
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: party.color }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">{party.name}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
