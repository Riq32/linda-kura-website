"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import type { AdminUnit, DrillLevel } from "@/shared/types";

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, AdminUnit["properties"]>;
type MapLocation = { level: DrillLevel; county?: AdminUnit; constituency?: AdminUnit; ward?: AdminUnit };
const files = { counties: "/geojson/counties.geojson", constituencies: "/geojson/constituencies.geojson", wards: "/geojson/wards.geojson" } as const;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The map data could not be loaded.";
}

function bbox(features: AdminUnit[]) {
  const values: number[][] = [];
  const visit = (node: unknown): void => { if (Array.isArray(node) && typeof node[0] === "number") values.push(node as number[]); else if (Array.isArray(node)) node.forEach(visit); };
  features.forEach(feature => visit(feature.geometry.coordinates));
  return values.reduce((result, [x, y]) => result.extend([x, y]), new maplibregl.LngLatBounds());
}

function pointInRing([x, y]: [number, number], ring: GeoJSON.Position[]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentX, currentY] = ring[index];
    const [previousX, previousY] = ring[previous];
    if ((currentY > y) !== (previousY > y) && x < (previousX - currentX) * (y - currentY) / (previousY - currentY) + currentX) inside = !inside;
  }
  return inside;
}

function containsPoint(feature: AdminUnit, point: [number, number]) {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return polygons.some(polygon => pointInRing(point, polygon[0]) && polygon.slice(1).every(hole => !pointInRing(point, hole)));
}

const PARTIES = [
  { name: 'UDA', color: '#f2a900' },
  { name: 'ODM', color: '#f26522' },
  { name: 'Jubilee', color: '#d12421' },
  { name: 'Wiper', color: '#00aeea' }
];

function blendPartyColors(winnerColor: string, runnerUpColor: string, margin: number) {
  const parseHex = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  
  const c1 = parseHex(winnerColor);
  const c2 = parseHex(runnerUpColor);
  
  const winnerRatio = Math.min(1, 0.5 + (margin / 60));
  const runnerUpRatio = 1 - winnerRatio;
  
  const r = Math.round(c1[0] * winnerRatio + c2[0] * runnerUpRatio);
  const g = Math.round(c1[1] * winnerRatio + c2[1] * runnerUpRatio);
  const b = Math.round(c1[2] * winnerRatio + c2[2] * runnerUpRatio);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function generateMockElectionData(featureId: string, level: string) {
  let hash = 0;
  const str = featureId + level;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  
  const random = () => {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };
  
  const p1Idx = Math.floor(random() * PARTIES.length);
  let p2Idx = Math.floor(random() * (PARTIES.length - 1));
  if (p2Idx >= p1Idx) p2Idx++;
  
  const winner = PARTIES[p1Idx];
  const runnerUp = PARTIES[p2Idx];
  
  const margin = random() * 40; 
  const winnerPct = 50 + margin / 2;
  const runnerUpPct = 50 - margin / 2 - random() * 5;
  const othersPct = 100 - winnerPct - runnerUpPct;
  
  return {
    winningParty: winner.name,
    runnerUp: runnerUp.name,
    margin,
    partyBreakdown: [
      { name: winner.name, percentage: winnerPct },
      { name: runnerUp.name, percentage: runnerUpPct },
      { name: 'Others', percentage: othersPct }
    ]
  };
}

export function DrilldownMap({ onLocationChange }: { onLocationChange: (location: MapLocation) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap>();
  const dataRef = useRef<Partial<Record<keyof typeof files, FeatureCollection>>>({});
  const visibleFeaturesRef = useRef<AdminUnit[]>([]);
  const locationRef = useRef<MapLocation>({ level: "country" });
  const hoveredId = useRef<string>();
  const [location, setLocation] = useState<MapLocation>({ level: "country" });
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number }>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [electionData, setElectionData] = useState<Record<string, any>>({});
  const electionDataRef = useRef<Record<string, any>>({});
  const [hoveredRegionData, setHoveredRegionData] = useState<{ name: string; data: any }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ name: string; level: string; hierarchy?: string; properties: any }[]>([]);

  const loadCollection = useCallback(async (name: keyof typeof files) => {
    if (!dataRef.current[name]) {
      const response = await fetch(files[name]);
      if (!response.ok) throw new Error(`Unable to load ${name} boundaries.`);
      const collection = await response.json() as FeatureCollection;
      if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) throw new Error(`Invalid ${name} boundary data.`);
      dataRef.current[name] = collection;
    }
    return dataRef.current[name]!;
  }, []);

  const showFeatures = useCallback((features: AdminUnit[], next: MapLocation) => {
    const map = mapRef.current;
    if (!map?.getSource("boundaries")) throw new Error("The map boundaries are not ready yet.");
    if (!features.length) throw new Error("No map boundaries are available for this selection.");
    
    const newElectionData: Record<string, any> = {};
    features.forEach(feature => {
      const id = feature.properties.shapeID;
      const data = generateMockElectionData(id, next.level);
      
      const winnerColor = PARTIES.find(p => p.name === data.winningParty)?.color ?? '#ffffff';
      const runnerUpColor = PARTIES.find(p => p.name === data.runnerUp)?.color ?? '#ffffff';
      const blendedColor = blendPartyColors(winnerColor, runnerUpColor, data.margin);
      
      newElectionData[id] = { ...data, blendedColor };
    });
    setElectionData(newElectionData);
    electionDataRef.current = newElectionData;

    (map.getSource("boundaries") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features });
    
    features.forEach(feature => {
      const id = feature.properties.shapeID;
      if (id && newElectionData[id]) {
        map.setFeatureState(
          { source: "boundaries", id },
          { 
            heatmapColor: newElectionData[id].blendedColor,
            margin: newElectionData[id].margin
          }
        );
      }
    });

    visibleFeaturesRef.current = features;
    const bounds = bbox(features);
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 72, duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800, pitch: 53, bearing: -10, maxZoom: next.level === "ward" ? 13 : next.level === "constituency" ? 11.5 : 9.5 });
    locationRef.current = next; setLocation(next); onLocationChange(next);
  }, [onLocationChange]);

  const navigate = useCallback(async (target: DrillLevel) => {
    setTooltip(undefined);
    setLoadError(undefined);
    try {
      if (target === "country") { const counties = await loadCollection("counties"); showFeatures(counties.features as AdminUnit[], { level: "country" }); return; }
      if (target === "county" && locationRef.current.county) {
        const constituencies = await loadCollection("constituencies");
        showFeatures(constituencies.features.filter(feature => feature.properties.county_shapeID === locationRef.current.county?.properties.shapeID) as AdminUnit[], { level: "county", county: locationRef.current.county });
      }
      if (target === "constituency" && locationRef.current.constituency) {
        const wards = await loadCollection("wards");
        showFeatures(wards.features.filter(feature => feature.properties.constituency_shapeID === locationRef.current.constituency?.properties.shapeID) as AdminUnit[], { level: "constituency", county: locationRef.current.county, constituency: locationRef.current.constituency });
      }
    } catch (error) { setLoadError(errorMessage(error)); }
  }, [loadCollection, showFeatures]);

  const drill = useCallback(async (properties: AdminUnit["properties"]) => {
    const current = locationRef.current;
    setLoadError(undefined);
    try {
      if (current.level === "country") {
        const county = { type: "Feature", properties, geometry: { type: "Polygon", coordinates: [] } } as AdminUnit;
        const counties = await loadCollection("counties");
        const realCounty = counties.features.find(feature => feature.properties.shapeID === properties.shapeID) as AdminUnit;
        const constituencies = await loadCollection("constituencies");
        showFeatures(constituencies.features.filter(feature => feature.properties.county_shapeID === properties.shapeID) as AdminUnit[], { level: "county", county: realCounty ?? county });
      } else if (current.level === "county") {
        const constituencies = await loadCollection("constituencies");
        const constituency = constituencies.features.find(feature => feature.properties.shapeID === properties.shapeID) as AdminUnit;
        const wards = await loadCollection("wards");
        showFeatures(wards.features.filter(feature => feature.properties.constituency_shapeID === properties.shapeID) as AdminUnit[], { level: "constituency", county: current.county, constituency });
      } else if (current.level === "constituency") {
        const wards = await loadCollection("wards");
        const ward = wards.features.find(feature => feature.properties.shapeID === properties.shapeID) as AdminUnit;
        showFeatures([ward], { level: "ward", county: current.county, constituency: current.constituency, ward });
      }
    } catch (error) { setLoadError(errorMessage(error)); }
  }, [loadCollection, showFeatures]);

  const jumpToResult = useCallback(async (result: { name: string; level: string; properties: any }) => {
    setSearchQuery("");
    setLoadError(undefined);
    try {
      const { level, properties } = result;
      if (level === "County") {
        const counties = await loadCollection("counties");
        const county = counties.features.find(f => f.properties.shapeID === properties.shapeID) as AdminUnit;
        const constituencies = await loadCollection("constituencies");
        const filtered = constituencies.features.filter(f => f.properties.county_shapeID === properties.shapeID) as AdminUnit[];
        showFeatures(filtered, { level: "county", county });
      } else if (level === "Constituency") {
        const targetConstituencyId = properties.shapeID;
        const constituencies = await loadCollection("constituencies");
        const constituency = constituencies.features.find(f => f.properties.shapeID === targetConstituencyId) as AdminUnit;
        
        const targetCountyId = properties.county_shapeID || constituency?.properties?.county_shapeID;
        const counties = await loadCollection("counties");
        const county = counties.features.find(f => f.properties.shapeID === targetCountyId) as AdminUnit;
        
        const wards = await loadCollection("wards");
        const filtered = wards.features.filter(f => f.properties.constituency_shapeID === targetConstituencyId) as AdminUnit[];
        
        showFeatures(filtered, { level: "constituency", county, constituency });
      } else if (level === "Ward") {
        const targetConstituencyId = properties.constituency_shapeID;
        const constituencies = await loadCollection("constituencies");
        const constituency = constituencies.features.find(f => f.properties.shapeID === targetConstituencyId) as AdminUnit;
        
        const targetCountyId = properties.county_shapeID || constituency?.properties?.county_shapeID;
        const counties = await loadCollection("counties");
        const county = counties.features.find(f => f.properties.shapeID === targetCountyId) as AdminUnit;
        
        const wards = await loadCollection("wards");
        const ward = wards.features.find(f => f.properties.shapeID === properties.shapeID) as AdminUnit;
        
        showFeatures([ward], { level: "ward", county, constituency, ward });
      }
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, [loadCollection, showFeatures]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: container.current, attributionControl: false, style: { version: 8, sources: {}, layers: [{ id: "ground", type: "background", paint: { "background-color": "#111213" } }] }, center: [37.9, 0.3], zoom: 5.2, pitch: 53, bearing: -10 });
    mapRef.current = map;
    requestAnimationFrame(() => map.resize());
    map.on("load", async () => {
      try {
        map.addSource("boundaries", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "shapeID" });
        map.addLayer({
          id: "boundary-extrusion",
          type: "fill-extrusion",
          source: "boundaries",
          paint: {
            "fill-extrusion-color": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              "#FFE600",
              ["coalesce", ["feature-state", "heatmapColor"], "#141618"]
            ],
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5, ["+", 1000, ["*", ["coalesce", ["feature-state", "margin"], 10], 62.5]],
              12, ["+", 200, ["*", ["coalesce", ["feature-state", "margin"], 10], 10]]
            ],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": .88
          }
        });
        map.addLayer({ id: "boundary-lines", type: "line", source: "boundaries", paint: { "line-color": "#333333", "line-opacity": .6, "line-width": 1.1 } });
      const clearHover = () => {
        if (hoveredId.current) map.setFeatureState({ source: "boundaries", id: hoveredId.current }, { hover: false });
        hoveredId.current = undefined;
        setTooltip(undefined);
        setHoveredRegionData(undefined);
        map.getCanvas().style.cursor = "";
      };
      const featureAtPointer = (event: maplibregl.MapMouseEvent) => {
        const renderedId = map.queryRenderedFeatures(event.point, { layers: ["boundary-extrusion"] })[0]?.properties?.shapeID;
        return visibleFeaturesRef.current.find(item => item.properties.shapeID === renderedId)
          ?? visibleFeaturesRef.current.find(item => containsPoint(item, [event.lngLat.lng, event.lngLat.lat]));
      };
      map.on("mousemove", event => {
        const feature = featureAtPointer(event);
        if (!feature) { clearHover(); return; }
        const id = feature.properties.shapeID;
        if (hoveredId.current && hoveredId.current !== id) map.setFeatureState({ source: "boundaries", id: hoveredId.current }, { hover: false });
        if (id && hoveredId.current !== id) {
          hoveredId.current = id;
          map.setFeatureState({ source: "boundaries", id }, { hover: true });
          setHoveredRegionData({ name: String(feature.properties.shapeName), data: electionDataRef.current[id] });
        }
        if (feature?.properties?.shapeName) {
          const width = container.current?.clientWidth ?? 0;
          const height = container.current?.clientHeight ?? 0;
          setTooltip({ name: String(feature.properties.shapeName), x: Math.max(10, Math.min(event.point.x + 14, width - 252)), y: Math.max(10, Math.min(event.point.y + 14, height - 50)) });
        }
        map.getCanvas().style.cursor = locationRef.current.level === "ward" ? "default" : "pointer";
      });
      map.on("mouseout", clearHover);
      map.on("click", event => {
        const feature = featureAtPointer(event);
        if (feature && locationRef.current.level !== "ward") void drill(feature.properties);
      });
        const counties = await loadCollection("counties");
        showFeatures(counties.features as AdminUnit[], { level: "country" });
        setIsLoading(false);
      } catch (error) {
        setLoadError(errorMessage(error));
        setIsLoading(false);
      }
    });
    return () => { map.remove(); mapRef.current = undefined; };
  }, [drill, loadCollection, showFeatures]);

  useEffect(() => {
    const resizeMap = () => requestAnimationFrame(() => mapRef.current?.resize());
    resizeMap();
    window.addEventListener("resize", resizeMap);
    return () => window.removeEventListener("resize", resizeMap);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const results: { name: string; level: string; hierarchy?: string; properties: any }[] = [];
    
    const searchLevel = (levelName: keyof typeof files, displayLevel: string) => {
      const collection = dataRef.current[levelName];
      if (collection) {
        for (const feature of collection.features) {
          if (feature.properties.shapeName?.toLowerCase().includes(query)) {
            if (!results.some(r => r.properties.shapeID === feature.properties.shapeID)) {
              let hierarchy = displayLevel;
              if (displayLevel === "Ward") {
                hierarchy = `Ward in ${feature.properties.constituency_shapeName ?? "Unknown"}, ${feature.properties.county_shapeName ?? "Unknown"}`;
              } else if (displayLevel === "Constituency") {
                hierarchy = `Constituency in ${feature.properties.county_shapeName ?? "Unknown"}`;
              }
              results.push({ name: String(feature.properties.shapeName), level: displayLevel, hierarchy, properties: feature.properties });
            }
            if (results.length >= 5) return true;
          }
        }
      }
      return false;
    };

    if (!searchLevel("counties", "County")) {
      if (!searchLevel("constituencies", "Constituency")) {
        searchLevel("wards", "Ward");
      }
    }

    setSearchResults(results.slice(0, 5));
  }, [searchQuery]);

  const crumbs = [
    { label: "Kenya", level: "country" as DrillLevel },
    ...(location.county ? [{ label: location.county.properties.shapeName, level: "county" as DrillLevel }] : []),
    ...(location.constituency ? [{ label: location.constituency.properties.shapeName, level: "constituency" as DrillLevel }] : []),
    ...(location.ward ? [{ label: location.ward.properties.shapeName, level: "ward" as DrillLevel }] : [])
  ];
  const caption = location.level === "country" ? { eyebrow: "National view", title: "Kenya counties", copy: "Select a county to explore its constituencies." } : location.level === "county" ? { eyebrow: "County view", title: `${location.county?.properties.shapeName ?? "County"} constituencies`, copy: "Select a constituency to explore its wards." } : { eyebrow: "Constituency view", title: `${location.constituency?.properties.shapeName ?? "Constituency"} wards`, copy: "Hover a ward to identify its boundary." };
  return <div className="relative h-full min-h-0 min-w-0 overflow-hidden bg-[#111213]">
    <div ref={container} className="absolute inset-0 z-[2]" aria-label="Interactive Kenya administrative boundary map" />
    <div className="pointer-events-none absolute left-6 top-6 z-20 grid gap-0.5"><span className="text-2xl font-bold tracking-[-0.03em] text-white">KURA</span><span className="text-[10px] uppercase tracking-[0.05em] text-[#888]">Kenya boundary explorer</span></div>
    
    <div className="absolute right-6 top-6 z-30 w-[min(300px,calc(100vw-48px))]">
      <input
        type="text"
        placeholder="Search regions..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full border border-[#2A2C2E] bg-[#181A1C] px-4 py-2.5 text-sm font-medium text-white placeholder:text-[#666] transition focus:border-[#FFE600] focus:outline-none"
      />
      {searchResults.length > 0 && (
        <ul className="absolute mt-1 w-full border border-[#2A2C2E] bg-[#181A1C]">
          {searchResults.map((result, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full border-b border-[#2A2C2E] px-4 py-3 text-left transition hover:bg-[#202224] last:border-0"
                onClick={() => void jumpToResult(result)}
              >
                <div className="text-sm font-medium tracking-tight text-white">
                  {result.name} <span className="text-[10px] uppercase tracking-wider text-[#888]">({result.hierarchy || result.level})</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>

    <nav className="absolute left-6 top-20 z-10 flex flex-wrap items-center gap-2" aria-label="Map location">
      {crumbs.map((crumb, index) => <span key={crumb.level} className="flex items-center gap-2">{index > 0 && <span className="text-[10px] text-[#444]">/</span>}<button type="button" onClick={() => index < crumbs.length - 1 && void navigate(crumb.level)} disabled={index === crumbs.length - 1} className="text-xs font-medium tracking-wide text-[#888] transition hover:text-white disabled:cursor-default disabled:text-white">{crumb.label}</button></span>)}
    </nav>
    <aside className="absolute bottom-6 left-6 z-10 w-[280px] border border-[#2A2C2E] bg-[#181A1C] p-5" aria-live="polite">
      {hoveredRegionData?.data ? (
        <div>
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.05em] text-[#888]">Projected Winner / <span className="text-white">{hoveredRegionData.data.winningParty}</span></p>
          <h2 className="mb-4 text-xl font-bold tracking-[-0.03em] text-white">{hoveredRegionData.name}</h2>
          
          <div className="mb-3 flex h-1.5 w-full bg-[#111213]">
            {hoveredRegionData.data.partyBreakdown.map((party: any) => {
              const partyColor = PARTIES.find(p => p.name === party.name)?.color ?? '#555';
              return party.percentage > 0 && (
                <div key={party.name} style={{ width: `${party.percentage}%`, backgroundColor: partyColor }} className="h-full" />
              );
            })}
          </div>
          
          <div className="flex flex-col gap-1.5">
            {hoveredRegionData.data.partyBreakdown.slice(0, 2).map((party: any) => {
              const partyColor = PARTIES.find(p => p.name === party.name)?.color ?? '#555';
              return (
                <div key={party.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2" style={{ backgroundColor: partyColor }} />
                    <span className="font-medium text-[#ccc]">{party.name}</span>
                  </div>
                  <span className="font-mono text-white">{party.percentage}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <h3 className="mb-2 text-sm font-bold tracking-tight text-white">{caption.eyebrow}</h3>
          <p className="text-xs leading-relaxed text-[#888]">{caption.copy}</p>
        </div>
      )}
    </aside>
    {tooltip && <div className="pointer-events-none absolute z-20 border border-[#2A2C2E] bg-[#181A1C] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.name}</div>}
    {isLoading && <div className="absolute inset-0 z-20 grid place-items-center bg-[#111213]/80 text-[10px] font-bold uppercase tracking-[0.2em] text-white"><span className="border border-[#2A2C2E] px-6 py-3">Loading Kenya</span></div>}
    {loadError && <div className="absolute inset-0 z-30 grid place-items-center bg-[#111213] p-6 text-center"><div><p className="text-sm font-bold text-white">Map unavailable</p><p className="mt-2 text-xs text-[#888]">{loadError}</p><button type="button" onClick={() => void navigate("country")} className="mt-6 border border-[#2A2C2E] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-[#2A2C2E]">Retry map</button></div></div>}
  </div>;
}
