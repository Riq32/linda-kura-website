"use client";

import { useCallback, useState } from "react";
import { DrilldownMap } from "@/components/drilldown-map";
import { ResultsPanel } from "@/components/results-panel";
import { getMockResults } from "@/lib/results";
import type { DrillLevel } from "@/shared/types";

export default function Home() {
  const [location, setLocation] = useState("National preview");
  const [level, setLevel] = useState<DrillLevel>("country");
  const results = getMockResults(level);
  const handleLocationChange = useCallback(({ level: nextLevel, county, constituency }: { level: DrillLevel; county?: { properties: { shapeName: string } }; constituency?: { properties: { shapeName: string } } }) => {
    setLevel(nextLevel);
    setLocation(nextLevel === "country" ? "National preview" : constituency?.properties.shapeName ?? county?.properties.shapeName ?? "Results");
  }, []);
  return <main className="min-h-screen bg-bg">
    <header className="sticky top-0 z-30 border-b border-white/[.06] bg-[rgba(11,18,16,.74)] px-4 py-3 backdrop-blur-[20px] md:px-8"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4"><a href="#top" className="flex items-center gap-2 text-lg font-bold tracking-[-.055em] text-ink"><i className="h-6 w-6 rotate-[-7deg] rounded-[9px_13px_10px_14px] bg-kenya-green shadow-[inset_0_1px_rgba(255,255,255,.18)]" /><span>LINDA<span className="text-gold">—</span>KURA</span></a><div className="flex items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-gold/15 px-3 py-2 text-xs font-semibold text-[#f4c767]"><i className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_0_4px_rgba(217,155,43,.12)]" />Mock feed · Local demo</span></div></div><nav className="mx-auto mt-2 flex max-w-[1600px] items-center gap-2 text-xs text-dim" aria-label="Page breadcrumb"><span>Kenya</span><span className="text-dim/50">/</span><strong className="font-semibold text-ink">Mock election results</strong></nav></header>
    <section id="top" className="mx-auto max-w-[1600px] p-4 md:p-8"><div className="grid min-h-[calc(100vh-130px)] grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_400px]"><DrilldownMap onLocationChange={handleLocationChange} /><div className="2xl:sticky 2xl:top-[130px] 2xl:self-start"><ResultsPanel location={location} results={results} /></div></div></section>
  </main>;
}
