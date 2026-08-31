"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import type { AdminUnit, DrillLevel, MapLocation, PollingStation, RegionElectionData } from "@/shared/types";

type StationCollection = GeoJSON.FeatureCollection<GeoJSON.Point, PollingStation["properties"]>;
type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, AdminUnit["properties"]>;
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

function getCenter(feature: AdminUnit): [number, number] {
  const b = bbox([feature]);
  const center = b.getCenter();
  return [center.lng, center.lat];
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

import { generateMockElectionData } from "@/lib/results";

export function DrilldownMap({ onLocationChange, onHoverChange }: { onLocationChange: (location: MapLocation) => void, onHoverChange: (data: RegionElectionData | null) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap>();
  const dataRef = useRef<Partial<Record<keyof typeof files, FeatureCollection>>>({});
  const visibleFeaturesRef = useRef<AdminUnit[]>([]);
  const locationRef = useRef<MapLocation>({ level: "country" });
  const hoveredId = useRef<string>();
  const [location, setLocation] = useState<MapLocation>({ level: "country" });
  const [tooltip, setTooltip] = useState<{ name: string; details?: string; x: number; y: number }>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [electionData, setElectionData] = useState<Record<string, RegionElectionData>>({});
  const electionDataRef = useRef<Record<string, RegionElectionData>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ name: string; level: string; hierarchy?: string; properties: any }[]>([]);
  const [viewMode, setViewMode] = useState<"3D" | "2D">("3D");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    // Animate camera on view mode change, ensuring map is loaded
    const animateCamera = () => {
      if (viewMode === "3D") {
        map.easeTo({ pitch: 58, bearing: -15, duration: 1000 });
      } else {
        map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      }
    };

    if (map.isStyleLoaded()) {
      animateCamera();
    } else {
      map.once("load", animateCamera);
    }
  }, [viewMode]);

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

    const newElectionData: Record<string, RegionElectionData> = {};
    features.forEach(feature => {
      const id = feature.properties.shapeID;
      const data = generateMockElectionData(id, next.level, String(feature.properties.shapeName));
      newElectionData[id] = data;
    });
    setElectionData(newElectionData);
    electionDataRef.current = newElectionData;

    (map.getSource("boundaries") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features });
    // Station points belong only to the selected ward. Clear them before every
    // higher-level navigation so they cannot persist while drilling back up.
    if (next.level !== "ward" && next.level !== "polling-station") {
      (map.getSource("polling-stations") as maplibregl.GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: [] });
    }

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
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 72, duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800, maxZoom: next.level === "ward" ? 13 : next.level === "constituency" ? 11.5 : 9.5 });
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

  const loadWardStations = useCallback(async (ward: AdminUnit) => {
    const response = await fetch("http://localhost:3001/api/polling-stations?wardShapeID=" + encodeURIComponent(ward.properties.shapeID));
    if (!response.ok) throw new Error("Polling stations could not be loaded.");
    const collection = await response.json() as StationCollection;
    (mapRef.current?.getSource("polling-stations") as maplibregl.GeoJSONSource | undefined)?.setData(collection);
  }, []);

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
        await loadWardStations(ward);
      }
    } catch (error) { setLoadError(errorMessage(error)); }
  }, [loadCollection, loadWardStations, showFeatures]);

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
    const map = new maplibregl.Map({ container: container.current, attributionControl: false, style: { version: 8, sources: {}, layers: [{ id: "ground", type: "background", paint: { "background-color": "#111213" } }] }, center: [37.9, 0.3], zoom: 5.2, pitch: 58, bearing: -15 });
    map.keyboard.disable();
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
        map.addSource("polling-stations", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "polling-stations", type: "circle", source: "polling-stations", paint: { "circle-radius": 4, "circle-color": "#000000", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 } });
        const clearHover = () => {
          if (hoveredId.current) map.setFeatureState({ source: "boundaries", id: hoveredId.current }, { hover: false });
          hoveredId.current = undefined;
          setTooltip(undefined);
          onHoverChange(null);
          map.getCanvas().style.cursor = "";
        };
        const featureAtPointer = (event: maplibregl.MapMouseEvent) => {
          const renderedId = map.queryRenderedFeatures(event.point, { layers: ["boundary-extrusion"] })[0]?.properties?.shapeID;
          return visibleFeaturesRef.current.find(item => item.properties.shapeID === renderedId)
            ?? visibleFeaturesRef.current.find(item => containsPoint(item, [event.lngLat.lng, event.lngLat.lat]));
        };
        map.on("mousemove", event => {
          const station = map.queryRenderedFeatures(event.point, { layers: ["polling-stations"] })[0];
          if (station) {
            const properties = station.properties as PollingStation["properties"];
            setTooltip({ name: properties.name, details: Number(properties.registeredVoters).toLocaleString() + " registered voters" + (properties.located === "approximate" ? " · Approximate location" : ""), x: event.point.x + 14, y: event.point.y + 14 });
            map.getCanvas().style.cursor = "pointer";
            return;
          }
          const feature = featureAtPointer(event);
          if (!feature) { clearHover(); return; }
          const id = feature.properties.shapeID;
          if (hoveredId.current && hoveredId.current !== id) map.setFeatureState({ source: "boundaries", id: hoveredId.current }, { hover: false });
          if (id && hoveredId.current !== id) {
            hoveredId.current = id;
            if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
            map.setFeatureState({ source: "boundaries", id }, { hover: true });
            onHoverChange(electionDataRef.current[id] || null);
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
          const station = map.queryRenderedFeatures(event.point, { layers: ["polling-stations"] })[0];
          if (station && locationRef.current.ward) {
            const selected = { type: "Feature", properties: station.properties as PollingStation["properties"], geometry: station.geometry as GeoJSON.Point } as PollingStation;
            const next = { ...locationRef.current, level: "polling-station" as const, station: selected };
            locationRef.current = next; setLocation(next); onLocationChange(next); return;
          }
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
    ...(location.ward ? [{ label: location.ward.properties.shapeName, level: "ward" as DrillLevel }] : []),
    ...(location.station ? [{ label: location.station.properties.name, level: "polling-station" as DrillLevel }] : [])
  ];
  const caption = location.level === "country" ? { eyebrow: "National view", title: "Kenya counties", copy: "Select a county to explore its constituencies." } : location.level === "county" ? { eyebrow: "County view", title: `${location.county?.properties.shapeName ?? "County"} constituencies`, copy: "Select a constituency to explore its wards." } : { eyebrow: "Constituency view", title: `${location.constituency?.properties.shapeName ?? "Constituency"} wards`, copy: "Hover a ward to identify its boundary." };
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const map = mapRef.current;
    if (!map) return;
    const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (keys.includes(e.key)) {
      e.preventDefault();
      const features = visibleFeaturesRef.current;
      if (!features.length) return;
      let currentFeature = features.find(f => f.properties.shapeID === hoveredId.current);
      if (!currentFeature) currentFeature = features[0];
      const [cx, cy] = getCenter(currentFeature);
      let bestFeature: AdminUnit | undefined;
      let minDistance = Infinity;
      features.forEach(f => {
        if (f.properties.shapeID === currentFeature?.properties.shapeID) return;
        const [fx, fy] = getCenter(f);
        let validDirection = false;
        if (e.key === "ArrowUp" && fy > cy) validDirection = true;
        if (e.key === "ArrowDown" && fy < cy) validDirection = true;
        if (e.key === "ArrowRight" && fx > cx) validDirection = true;
        if (e.key === "ArrowLeft" && fx < cx) validDirection = true;
        if (validDirection) {
          const dist = Math.sqrt(Math.pow(fx - cx, 2) + Math.pow(fy - cy, 2));
          if (dist < minDistance) {
            minDistance = dist;
            bestFeature = f;
          }
        }
      });
      if (bestFeature) {
        const newId = bestFeature.properties.shapeID;
        if (hoveredId.current) map.setFeatureState({ source: "boundaries", id: hoveredId.current }, { hover: false });
        hoveredId.current = newId;
        map.setFeatureState({ source: "boundaries", id: newId }, { hover: true });
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
        onHoverChange(electionDataRef.current[newId] || null);
        setAnnouncement(`Navigated to ${bestFeature.properties.shapeName}`);
        const [bx, by] = getCenter(bestFeature);
        map.flyTo({ center: [bx, by], speed: 1.2 });
      }
    } else if (e.key === "Enter") {
      const currentFeature = visibleFeaturesRef.current.find(f => f.properties.shapeID === hoveredId.current);
      if (currentFeature && locationRef.current.level !== "ward") {
        void drill(currentFeature.properties);
        setAnnouncement(`Drilled into ${currentFeature.properties.shapeName}`);
      }
    }
  }, [drill, onHoverChange]);

  return <div className="relative h-full min-h-0 min-w-0 overflow-hidden bg-[#111213]">
    <div ref={container} tabIndex={0} onKeyDown={handleKeyDown} className="absolute inset-0 z-[2] focus:outline-none" aria-label="Interactive Kenya administrative boundary map" />
    <span aria-live="assertive" className="sr-only absolute opacity-0 pointer-events-none">{announcement}</span>
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

    <nav className="absolute left-6 top-20 z-10 flex flex-wrap items-center gap-4" aria-label="Map location">
      <div className="flex flex-wrap items-center gap-2">
        {crumbs.map((crumb, index) => <span key={crumb.level} className="flex items-center gap-2">{index > 0 && <span className="text-[10px] text-[#444]">/</span>}<button type="button" onClick={() => index < crumbs.length - 1 && void navigate(crumb.level)} disabled={index === crumbs.length - 1} className="text-xs font-medium tracking-wide text-[#888] transition hover:text-white disabled:cursor-default disabled:text-white">{crumb.label}</button></span>)}
      </div>
      <div className="flex items-center rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur-md">
        <button type="button" onClick={() => setViewMode("2D")} className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${viewMode === "2D" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}>2D</button>
        <button type="button" onClick={() => setViewMode("3D")} className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${viewMode === "3D" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}>3D</button>
      </div>
    </nav>

    {tooltip && <div className="pointer-events-none absolute z-20 border border-[#2A2C2E] bg-[#181A1C] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.name}{tooltip.details && <span className="mt-1 block font-medium normal-case tracking-normal text-white/65">{tooltip.details}</span>}</div>}
    {isLoading && <div className="absolute inset-0 z-20 grid place-items-center bg-[#111213]/80 text-[10px] font-bold uppercase tracking-[0.2em] text-white"><span className="border border-[#2A2C2E] px-6 py-3">Loading Kenya</span></div>}
    {loadError && <div className="absolute inset-0 z-30 grid place-items-center bg-[#111213] p-6 text-center"><div><p className="text-sm font-bold text-white">Map unavailable</p><p className="mt-2 text-xs text-[#888]">{loadError}</p><button type="button" onClick={() => void navigate("country")} className="mt-6 border border-[#2A2C2E] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-[#2A2C2E]">Retry map</button></div></div>}
  </div>;
}
