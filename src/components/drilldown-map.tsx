"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import type { AdminUnit, DrillLevel } from "@/shared/types";

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, AdminUnit["properties"]>;
type MapLocation = { level: DrillLevel; county?: AdminUnit; constituency?: AdminUnit };
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
    (map.getSource("boundaries") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features });
    visibleFeaturesRef.current = features;
    const bounds = bbox(features);
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 72, duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800, pitch: 53, bearing: -10, maxZoom: next.level === "ward" ? 11.2 : 8.8 });
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
        showFeatures(wards.features.filter(feature => feature.properties.constituency_shapeID === properties.shapeID) as AdminUnit[], { level: "ward", county: current.county, constituency });
      }
    } catch (error) { setLoadError(errorMessage(error)); }
  }, [loadCollection, showFeatures]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: container.current, attributionControl: false, style: { version: 8, sources: {}, layers: [{ id: "ground", type: "background", paint: { "background-color": "#0d4d3b" } }] }, center: [37.9, 0.3], zoom: 5.2, pitch: 53, bearing: -10 });
    mapRef.current = map;
    requestAnimationFrame(() => map.resize());
    map.on("load", async () => {
      try {
        map.addSource("boundaries", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "shapeID" });
        map.addLayer({ id: "boundary-extrusion", type: "fill-extrusion", source: "boundaries", paint: { "fill-extrusion-color": ["case", ["boolean", ["feature-state", "hover"], false], "#d99b2b", "#1a7a4c"], "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 5, 3500, 12, 500], "fill-extrusion-base": 0, "fill-extrusion-opacity": .88 } });
        map.addLayer({ id: "boundary-lines", type: "line", source: "boundaries", paint: { "line-color": "#eef3ef", "line-opacity": .44, "line-width": 1.1 } });
      const clearHover = () => {
        if (hoveredId.current) map.setFeatureState({ source: "boundaries", id: hoveredId.current }, { hover: false });
        hoveredId.current = undefined;
        setTooltip(undefined);
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
        if (id) { hoveredId.current = id; map.setFeatureState({ source: "boundaries", id }, { hover: true }); }
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

  const crumbs = [{ label: "Kenya", level: "country" as DrillLevel }, ...(location.county ? [{ label: location.county.properties.shapeName, level: "county" as DrillLevel }] : []), ...(location.constituency ? [{ label: location.constituency.properties.shapeName, level: "ward" as DrillLevel }] : [])];
  const caption = location.level === "country" ? { eyebrow: "National view", title: "Kenya counties", copy: "Select a county to explore its constituencies." } : location.level === "county" ? { eyebrow: "County view", title: `${location.county?.properties.shapeName ?? "County"} constituencies`, copy: "Select a constituency to explore its wards." } : { eyebrow: "Constituency view", title: `${location.constituency?.properties.shapeName ?? "Constituency"} wards`, copy: "Hover a ward to identify its boundary." };
  return <div className="relative h-full min-h-0 min-w-0 overflow-hidden rounded-[32px_28px_32px_28px] bg-[#07291f] shadow-elevation">
    <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_17%_20%,rgba(75,154,112,.22),transparent_31rem),radial-gradient(circle_at_87%_83%,rgba(230,198,113,.15),transparent_30rem),linear-gradient(145deg,#0d4d3b_0%,#082f25_47%,#041c16_100%)]" />
    <div ref={container} className="absolute inset-0 z-[2]" aria-label="Interactive Kenya administrative boundary map" />
    <div className="pointer-events-none absolute left-5 top-4 z-20 grid gap-1 sm:left-[clamp(20px,4vw,56px)] sm:top-7"><span className="text-[15px] font-bold tracking-[.16em] text-ink">KURA</span><span className="text-[11px] uppercase tracking-[.12em] text-[#a5d6bb]">Kenya boundary explorer</span></div>
    <nav className="absolute left-4 right-4 top-12 z-10 flex w-auto flex-wrap items-center justify-between gap-1 rounded-[22px] border border-white/[.16] bg-[rgba(7,41,31,.72)] p-2.5 shadow-elevation backdrop-blur-xl md:left-auto md:right-5 md:top-6 md:w-[min(460px,calc(100%_-_150px))] md:translate-x-0" aria-label="Map location">
      {crumbs.map((crumb, index) => <span key={crumb.level} className="flex items-center gap-1">{index > 0 && <span className="px-1 text-white/40">›</span>}<button type="button" onClick={() => index < crumbs.length - 1 && void navigate(crumb.level)} disabled={index === crumbs.length - 1} className="rounded-[10px] px-2 py-1.5 text-[13px] font-medium text-[#a5d6bb] transition hover:bg-[#a5d6bb]/15 hover:text-ink disabled:cursor-default disabled:text-ink disabled:hover:bg-transparent active:scale-[.98]">{crumb.label}</button></span>)}
    </nav>
    <aside className="absolute bottom-5 left-5 right-5 z-10 w-auto rounded-[14px] border border-white/[.16] bg-[rgba(4,30,22,.54)] px-[18px] py-4 shadow-elevation backdrop-blur-xl sm:bottom-8 sm:left-[clamp(20px,4vw,56px)] sm:right-auto sm:w-[min(286px,calc(100%-40px))]" aria-live="polite"><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.13em] text-[#e6c671]">{caption.eyebrow}</p><h2 className="text-base font-semibold tracking-[-.015em] text-ink">{caption.title}</h2><p className="mt-1 text-xs leading-[1.45] text-[#b7c5b8]">{caption.copy}</p></aside>
    {tooltip && <div className="pointer-events-none absolute z-20 rounded-[10px] border border-[#f6e8b7]/35 bg-[rgba(3,27,19,.91)] px-3 py-2 text-xs font-semibold text-ink shadow-elevation" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.name}</div>}
    {isLoading && <div className="absolute inset-0 z-20 grid place-items-center bg-bg/60 text-xs font-semibold uppercase tracking-[.1em] text-[#a5d6bb] backdrop-blur-sm" role="status"><span className="rounded-full border border-white/[.16] bg-[rgba(3,34,24,.7)] px-4 py-3">Loading Kenya</span></div>}
    {loadError && <div className="absolute inset-4 z-30 grid place-items-center rounded-continuous bg-panel/95 p-6 text-center shadow-elevation" role="alert"><div><p className="text-sm font-semibold text-ink">Map unavailable</p><p className="mt-2 max-w-xs text-xs leading-relaxed text-dim">{loadError}</p><button type="button" onClick={() => void navigate("country")} className="mt-4 rounded-xl bg-kenya-green px-3 py-2 text-xs font-semibold text-ink transition hover:brightness-110 active:scale-[.98]">Retry map</button></div></div>}
  </div>;
}
