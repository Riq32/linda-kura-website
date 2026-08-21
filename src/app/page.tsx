"use client";

import { useCallback, useState, useMemo } from "react";
import { DrilldownMap } from "@/components/drilldown-map";
import { ResultsPanel } from "@/components/results-panel";
import { generateMockElectionData } from "@/lib/results";
import type { MapLocation, RegionElectionData } from "@/shared/types";

export default function Home() {
  const [location, setLocation] = useState<MapLocation>({ level: "country" });
  const [hoveredData, setHoveredData] = useState<RegionElectionData | null>(null);

  const nationalData = useMemo(() => generateMockElectionData("KENYA", "country", "Kenya"), []);

  // fallback to selected location data when not hovering
  const selectedData = useMemo(() => {
    if (location.level === "country") return nationalData;
    const target = location.ward || location.constituency || location.county;
    if (!target) return nationalData;
    return generateMockElectionData(target.properties.shapeID, location.level, String(target.properties.shapeName));
  }, [location, nationalData]);

  const activeData = hoveredData || selectedData;

  const handleLocationChange = useCallback((newLocation: MapLocation) => {
    setLocation(newLocation);
  }, []);

  return <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#111213]">
    <header className="sticky top-0 z-30 border-b border-white/[.06] bg-[rgba(17,18,19,.74)] px-4 py-3 backdrop-blur-[20px] md:px-8"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4"><a href="#top" className="flex min-w-0 shrink items-center gap-2 text-lg font-bold tracking-[-.055em] text-white"><i className="h-6 w-6 shrink-0 rotate-[-7deg] rounded-[9px_13px_10px_14px] bg-green-500 shadow-[inset_0_1px_rgba(255,255,255,.18)]" /><span className="whitespace-nowrap">LINDA<span className="text-[#f2a900]">—</span>KURA</span></a><div className="flex shrink-0 items-center gap-2"><span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[#f2a900]/15 px-3 py-2 text-xs font-semibold text-[#f2a900]"><i className="h-1.5 w-1.5 rounded-full bg-[#f2a900] shadow-[0_0_0_4px_rgba(242,169,0,.12)]" />Mock feed · Local demo</span></div></div><nav className="mx-auto mt-2 flex max-w-[1600px] items-center gap-2 text-xs text-white/50" aria-label="Page breadcrumb"><span>Kenya</span><span className="text-white/30">/</span><strong className="font-semibold text-white">Mock election results</strong></nav></header>
    <section id="top" className="relative mx-auto min-h-0 w-full max-w-[1600px] flex-1 px-4 pb-4 pt-4 md:px-[clamp(16px,3vw,48px)] md:pb-8 md:pt-6"><div className="grid h-full min-h-0 grid-cols-1 gap-0 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-6"><div className="min-h-0 md:sticky md:top-0 md:h-full"><DrilldownMap onLocationChange={handleLocationChange} onHoverChange={setHoveredData} /></div><div className="fixed inset-x-2 bottom-0 z-20 h-[min(63dvh,560px)] min-h-0 md:static md:z-auto md:h-full"><ResultsPanel location={location} activeData={activeData} nationalData={nationalData} /></div></div></section>
  </main>;
}
