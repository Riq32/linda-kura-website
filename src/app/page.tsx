"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { DrilldownMap } from "@/components/drilldown-map";
import { ResultsPanel } from "@/components/results-panel";
import { generateGranularRegionData } from "@/lib/election-engine";
import { getRegionElectionData } from "@/lib/api-client";
import type { MapLocation, DetailedRegionData, RegionElectionData } from "@/shared/types";

export default function Home() {
  const { data: session } = useSession();
  const [location, setLocation] = useState<MapLocation>({ level: "country" });
  const [hoveredData, setHoveredData] = useState<DetailedRegionData | null>(null);
  const [nationalData, setNationalData] = useState<DetailedRegionData>(() =>
    generateGranularRegionData("KENYA", "Kenya", "country")
  );

  // Fetch initial live national data
  useEffect(() => {
    async function loadNational() {
      const data = await getRegionElectionData("KENYA", "country", "Kenya");
      setNationalData(data);
    }
    loadNational();
  }, []);

<<<<<<< HEAD
  // fallback to selected location data when not hovering
  const selectedData = useMemo(() => {
    if (location.level === "country") return nationalData;
    const target = location.station || location.ward || location.constituency || location.county;
    if (!target) return nationalData;
    return generateMockElectionData(("wardShapeID" in target.properties ? target.properties.wardShapeID + target.properties.name : target.properties.shapeID), location.level, String("name" in target.properties ? target.properties.name : target.properties.shapeName));
=======
  // Compute selected data based on active location
  const [selectedData, setSelectedData] = useState<DetailedRegionData>(nationalData);

  useEffect(() => {
    if (location.level === "country") {
      setSelectedData(nationalData);
      return;
    }
    const target = location.ward || location.constituency || location.county;
    if (!target) {
      setSelectedData(nationalData);
      return;
    }

    let isMounted = true;
    const countyName = target.properties.county_shapeName || (location.county ? location.county.properties.shapeName : undefined);
    const constituencyName = target.properties.constituency_shapeName || (location.constituency ? location.constituency.properties.shapeName : undefined);

    getRegionElectionData(
      target.properties.shapeID,
      location.level,
      String(target.properties.shapeName),
      countyName,
      constituencyName
    ).then((res) => {
      if (isMounted) setSelectedData(res);
    });

    return () => {
      isMounted = false;
    };
>>>>>>> ephra
  }, [location, nationalData]);

  const activeData = hoveredData || selectedData;

  const handleLocationChange = useCallback((newLocation: MapLocation) => {
    setLocation(newLocation);
  }, []);

  const agent = session?.user?.agentProfile;

  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#F8FAFC]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 px-4 py-2.5 backdrop-blur-xl md:px-8 shadow-xs">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2.5 text-xl font-extrabold tracking-tight text-slate-900 hover:opacity-90 transition"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white shadow-2xs">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="whitespace-nowrap font-extrabold tracking-tight">
              LINDA<span className="text-slate-300 font-light mx-1">/</span>KURA
            </span>
            <span className="hidden lg:inline-block rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono">
              Electoral Intelligence
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live Election Stream
            </span>

            {agent ? (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 shadow-2xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>Station: {agent.access_code} →</span>
              </Link>
            ) : (
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-slate-800"
              >
                <span> Login </span>
                <span className="text-xs opacity-75">🔑</span>
              </Link>
            )}
          </div>
        </div>

        <nav
          className="mx-auto mt-1 flex max-w-[1600px] items-center gap-1.5 text-[11px] font-mono text-slate-400"
          aria-label="Page breadcrumb"
        >
          <span className="font-semibold text-slate-600">Kenya</span>
          <span>/</span>
          <strong className="font-semibold text-slate-800">Electoral Telemetry</strong>
          <span>/</span>
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.2 font-bold text-slate-700 uppercase shadow-2xs">
            {location.level}
          </span>
        </nav>
      </header>

      <section
        id="top"
        className="relative mx-auto min-h-0 w-full max-w-[1600px] flex-1 px-4 pb-4 pt-3 md:px-[clamp(16px,3vw,48px)] md:pb-6 md:pt-4"
      >
        <div className="grid h-full min-h-0 grid-cols-1 gap-0 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-5">
          <div className="min-h-0 md:sticky md:top-0 md:h-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/5">
            <DrilldownMap onLocationChange={handleLocationChange} onHoverChange={setHoveredData} />
          </div>
          <div className="fixed inset-x-2 bottom-0 z-20 h-[min(63dvh,560px)] min-h-0 md:static md:z-auto md:h-full">
            <ResultsPanel location={location} activeData={activeData} nationalData={nationalData} />
          </div>
        </div>
      </section>
    </main>
  );
}
