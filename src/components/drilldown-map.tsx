"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import type { AdminUnit, DrillLevel, MapLocation, DetailedRegionData, RaceType } from "@/shared/types";
import { generateGranularRegionData, blendPartyColors, ALL_RACE_TYPES } from "@/lib/election-engine";

export type MapVisualizationMode = "margin" | "turnout" | "battleground";

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, AdminUnit["properties"]>;
const files = {
  counties: "/geojson/counties.geojson",
  constituencies: "/geojson/constituencies.geojson",
  wards: "/geojson/wards.geojson"
} as const;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The map data could not be loaded.";
}

function bbox(features: AdminUnit[]) {
  const values: number[][] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node) && typeof node[0] === "number") values.push(node as number[]);
    else if (Array.isArray(node)) node.forEach(visit);
  };
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

/**
 * Calculates a smooth scientific gradient for turnout:
 * Low turnout (~45% or below): soft ocean slate #3b82f6
 * Mid turnout (~65%): deep teal #0d9488
 * High turnout (~85%+): vibrant emerald #059669
 */
export function getTurnoutGradientColor(turnoutPct: number): string {
  const clamped = Math.min(90, Math.max(45, turnoutPct));
  const t = (clamped - 45) / 45; // 0 to 1

  let r: number, g: number, b: number;
  if (t < 0.5) {
    const localT = t * 2;
    // From [59, 130, 246] (#3b82f6) to [13, 148, 136] (#0d9488)
    r = Math.round(59 + (13 - 59) * localT);
    g = Math.round(130 + (148 - 130) * localT);
    b = Math.round(246 + (136 - 246) * localT);
  } else {
    const localT = (t - 0.5) * 2;
    // From [13, 148, 136] (#0d9488) to [5, 150, 105] (#059669)
    r = Math.round(13 + (5 - 13) * localT);
    g = Math.round(148 + (150 - 148) * localT);
    b = Math.round(136 + (105 - 136) * localT);
  }

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export interface DrilldownMapProps {
  onLocationChange: (location: MapLocation) => void;
  onHoverChange: (data: DetailedRegionData | null) => void;
}

interface HoverTooltipState {
  x: number;
  y: number;
  data: DetailedRegionData;
}

export function DrilldownMap({ onLocationChange, onHoverChange }: DrilldownMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap>();
  const dataRef = useRef<Partial<Record<keyof typeof files, FeatureCollection>>>({});
  const visibleFeaturesRef = useRef<AdminUnit[]>([]);
  const locationRef = useRef<MapLocation>({ level: "country" });
  const hoveredId = useRef<string>();
  const [location, setLocation] = useState<MapLocation>({ level: "country" });
  const [tooltip, setTooltip] = useState<HoverTooltipState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [electionData, setElectionData] = useState<Record<string, DetailedRegionData>>({});
  const electionDataRef = useRef<Record<string, DetailedRegionData>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ name: string; level: string; hierarchy?: string; properties: any }[]>([]);
  const [viewMode, setViewMode] = useState<"3D" | "2D">("3D");
  const [announcement, setAnnouncement] = useState("");

  // Map Controls State
  const [selectedRace, setSelectedRace] = useState<RaceType>("President");
  const [metricMode, setMetricMode] = useState<MapVisualizationMode>("margin");

  // Animate camera on 2D/3D view mode change
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    const animateCamera = () => {
      if (viewMode === "3D") {
        map.easeTo({ pitch: 56, bearing: -12, duration: 1000 });
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
      const collection = (await response.json()) as FeatureCollection;
      if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
        throw new Error(`Invalid ${name} boundary data.`);
      }
      dataRef.current[name] = collection;
    }
    return dataRef.current[name]!;
  }, []);

  /**
   * Updates MapLibre feature-state (heatmapColor, margin) for visible boundaries
   * based on the selected race and visualization mode.
   */
  const updateFeatureStates = useCallback(
    (
      features: AdminUnit[],
      dataMap: Record<string, DetailedRegionData>,
      race: RaceType,
      mode: MapVisualizationMode
    ) => {
      const map = mapRef.current;
      if (!map || !map.getSource("boundaries")) return;

      features.forEach(feature => {
        const id = feature.properties.shapeID;
        const region = dataMap[id];
        if (!id || !region) return;

        const tally = region.races?.[race] || region.races?.["President"];
        let heatmapColor = region.blendedColor;
        let extrusionHeight = tally ? tally.margin : 10;

        if (mode === "margin") {
          if (tally && tally.winner && tally.runnerUp) {
            heatmapColor = blendPartyColors(
              tally.winner.partyColor,
              tally.runnerUp.partyColor,
              tally.margin
            );
            extrusionHeight = Math.max(5, tally.margin);
          } else {
            heatmapColor = region.blendedColor;
          }
        } else if (mode === "turnout") {
          const turnout = tally?.turnoutPct ?? region.turnoutPct;
          heatmapColor = getTurnoutGradientColor(turnout);
          extrusionHeight = Math.max(5, (turnout - 40) * 0.85);
        } else if (mode === "battleground") {
          const margin = tally?.margin ?? 10;
          if (margin <= 5) {
            heatmapColor = "#D97706"; // Amber-600 battleground highlight
            extrusionHeight = 35;
          } else {
            heatmapColor = "#E2E8F0"; // Slate-200 calm background
            extrusionHeight = 4;
          }
        }

        map.setFeatureState(
          { source: "boundaries", id },
          {
            heatmapColor,
            margin: extrusionHeight
          }
        );
      });
    },
    []
  );

  // Dynamic recoloring when selected race or visualization mode changes
  useEffect(() => {
    updateFeatureStates(visibleFeaturesRef.current, electionDataRef.current, selectedRace, metricMode);
  }, [selectedRace, metricMode, updateFeatureStates]);

  const showFeatures = useCallback(
    (features: AdminUnit[], next: MapLocation) => {
      const map = mapRef.current;
      if (!map?.getSource("boundaries")) throw new Error("The map boundaries are not ready yet.");
      if (!features.length) throw new Error("No map boundaries are available for this selection.");

      const newElectionData: Record<string, DetailedRegionData> = {};
      features.forEach(feature => {
        const id = feature.properties.shapeID;
        const county_shapeName = feature.properties.county_shapeName || (next.county ? next.county.properties.shapeName : undefined);
        const constituency_shapeName = feature.properties.constituency_shapeName || (next.constituency ? next.constituency.properties.shapeName : undefined);

        const data = generateGranularRegionData(
          id,
          String(feature.properties.shapeName),
          next.level,
          county_shapeName,
          constituency_shapeName
        );
        newElectionData[id] = data;
      });

      setElectionData(newElectionData);
      electionDataRef.current = newElectionData;

      (map.getSource("boundaries") as maplibregl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features
      });

      // Apply initial feature-state colors & heights
      updateFeatureStates(features, newElectionData, selectedRace, metricMode);

      visibleFeaturesRef.current = features;
      const bounds = bbox(features);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: 72,
          duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800,
          maxZoom: next.level === "ward" ? 13 : next.level === "constituency" ? 11.5 : 9.5
        });
      }
      locationRef.current = next;
      setLocation(next);
      onLocationChange(next);
    },
    [onLocationChange, selectedRace, metricMode, updateFeatureStates]
  );

  const navigate = useCallback(
    async (target: DrillLevel) => {
      setTooltip(null);
      setLoadError(undefined);
      try {
        if (target === "country") {
          const counties = await loadCollection("counties");
          showFeatures(counties.features as AdminUnit[], { level: "country" });
          setAnnouncement("Navigated to National Country view");
          return;
        }
        if (target === "county" && locationRef.current.county) {
          const constituencies = await loadCollection("constituencies");
          showFeatures(
            constituencies.features.filter(
              feature => feature.properties.county_shapeID === locationRef.current.county?.properties.shapeID
            ) as AdminUnit[],
            { level: "county", county: locationRef.current.county }
          );
          setAnnouncement(`Navigated to ${locationRef.current.county.properties.shapeName} constituencies`);
        }
        if (target === "constituency" && locationRef.current.constituency) {
          const wards = await loadCollection("wards");
          showFeatures(
            wards.features.filter(
              feature => feature.properties.constituency_shapeID === locationRef.current.constituency?.properties.shapeID
            ) as AdminUnit[],
            {
              level: "constituency",
              county: locationRef.current.county,
              constituency: locationRef.current.constituency
            }
          );
          setAnnouncement(`Navigated to ${locationRef.current.constituency.properties.shapeName} wards`);
        }
      } catch (error) {
        setLoadError(errorMessage(error));
      }
    },
    [loadCollection, showFeatures]
  );

  const drill = useCallback(
    async (properties: AdminUnit["properties"]) => {
      const current = locationRef.current;
      setLoadError(undefined);
      try {
        if (current.level === "country") {
          const county = { type: "Feature", properties, geometry: { type: "Polygon", coordinates: [] } } as AdminUnit;
          const counties = await loadCollection("counties");
          const realCounty = counties.features.find(feature => feature.properties.shapeID === properties.shapeID) as AdminUnit;
          const constituencies = await loadCollection("constituencies");
          showFeatures(
            constituencies.features.filter(feature => feature.properties.county_shapeID === properties.shapeID) as AdminUnit[],
            { level: "county", county: realCounty ?? county }
          );
          setAnnouncement(`Drilled into ${properties.shapeName} County`);
        } else if (current.level === "county") {
          const constituencies = await loadCollection("constituencies");
          const constituency = constituencies.features.find(feature => feature.properties.shapeID === properties.shapeID) as AdminUnit;
          const wards = await loadCollection("wards");
          showFeatures(
            wards.features.filter(feature => feature.properties.constituency_shapeID === properties.shapeID) as AdminUnit[],
            { level: "constituency", county: current.county, constituency }
          );
          setAnnouncement(`Drilled into ${properties.shapeName} Constituency`);
        } else if (current.level === "constituency") {
          const wards = await loadCollection("wards");
          const ward = wards.features.find(feature => feature.properties.shapeID === properties.shapeID) as AdminUnit;
          showFeatures([ward], { level: "ward", county: current.county, constituency: current.constituency, ward });
          setAnnouncement(`Viewing ${properties.shapeName} Ward`);
        }
      } catch (error) {
        setLoadError(errorMessage(error));
      }
    },
    [loadCollection, showFeatures]
  );

  const jumpToResult = useCallback(
    async (result: { name: string; level: string; properties: any }) => {
      setSearchQuery("");
      setLoadError(undefined);
      try {
        const { level: resLevel, properties } = result;
        if (resLevel === "County") {
          const counties = await loadCollection("counties");
          const county = counties.features.find(f => f.properties.shapeID === properties.shapeID) as AdminUnit;
          const constituencies = await loadCollection("constituencies");
          const filtered = constituencies.features.filter(f => f.properties.county_shapeID === properties.shapeID) as AdminUnit[];
          showFeatures(filtered, { level: "county", county });
        } else if (resLevel === "Constituency") {
          const targetConstituencyId = properties.shapeID;
          const constituencies = await loadCollection("constituencies");
          const constituency = constituencies.features.find(f => f.properties.shapeID === targetConstituencyId) as AdminUnit;

          const targetCountyId = properties.county_shapeID || constituency?.properties?.county_shapeID;
          const counties = await loadCollection("counties");
          const county = counties.features.find(f => f.properties.shapeID === targetCountyId) as AdminUnit;

          const wards = await loadCollection("wards");
          const filtered = wards.features.filter(f => f.properties.constituency_shapeID === targetConstituencyId) as AdminUnit[];

          showFeatures(filtered, { level: "constituency", county, constituency });
        } else if (resLevel === "Ward") {
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
    },
    [loadCollection, showFeatures]
  );

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      attributionControl: false,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "ground",
            type: "background",
            paint: { "background-color": "#EEF2F6" } // Crisp, bright modern light canvas
          }
        ]
      },
      center: [37.9, 0.3],
      zoom: 5.2,
      pitch: 56,
      bearing: -12
    });

    map.keyboard.disable();
    mapRef.current = map;
    requestAnimationFrame(() => map.resize());

    map.on("load", async () => {
      try {
        map.addSource("boundaries", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          promoteId: "shapeID"
        });

        map.addLayer({
          id: "boundary-extrusion",
          type: "fill-extrusion",
          source: "boundaries",
          paint: {
            "fill-extrusion-color": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              "#FDE047", // Vibrant amber/yellow hover highlight
              ["coalesce", ["feature-state", "heatmapColor"], "#E2E8F0"]
            ],
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5, ["+", 1000, ["*", ["coalesce", ["feature-state", "margin"], 10], 62.5]],
              12, ["+", 200, ["*", ["coalesce", ["feature-state", "margin"], 10], 10]]
            ],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.94
          }
        });

        map.addLayer({
          id: "boundary-lines",
          type: "line",
          source: "boundaries",
          paint: {
            "line-color": "#94A3B8",
            "line-opacity": 0.7,
            "line-width": 1.2
          }
        });

        const clearHover = () => {
          if (hoveredId.current) map.setFeatureState({ source: "boundaries", id: hoveredId.current }, { hover: false });
          hoveredId.current = undefined;
          setTooltip(null);
          onHoverChange(null);
          map.getCanvas().style.cursor = "";
        };

        const featureAtPointer = (event: maplibregl.MapMouseEvent) => {
          const renderedId = map.queryRenderedFeatures(event.point, { layers: ["boundary-extrusion"] })[0]?.properties?.shapeID;
          return (
            visibleFeaturesRef.current.find(item => item.properties.shapeID === renderedId) ??
            visibleFeaturesRef.current.find(item => containsPoint(item, [event.lngLat.lng, event.lngLat.lat]))
          );
        };

        map.on("mousemove", event => {
          const feature = featureAtPointer(event);
          if (!feature) {
            clearHover();
            return;
          }

          const id = feature.properties.shapeID;
          if (hoveredId.current && hoveredId.current !== id) {
            map.setFeatureState({ source: "boundaries", id: hoveredId.current }, { hover: false });
          }

          if (id && hoveredId.current !== id) {
            hoveredId.current = id;
            if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
            map.setFeatureState({ source: "boundaries", id }, { hover: true });
            onHoverChange(electionDataRef.current[id] || null);
          }

          const regionData = electionDataRef.current[id];
          if (feature?.properties?.shapeName && regionData) {
            const width = container.current?.clientWidth ?? 0;
            const height = container.current?.clientHeight ?? 0;
            const x = Math.max(16, Math.min(event.point.x + 16, width - 300));
            const y = Math.max(16, Math.min(event.point.y + 16, height - 220));

            setTooltip({
              x,
              y,
              data: regionData
            });
          }

          map.getCanvas().style.cursor = locationRef.current.level === "ward" ? "default" : "pointer";
        });

        map.on("mouseout", clearHover);

        map.on("click", event => {
          const feature = featureAtPointer(event);
          if (feature && locationRef.current.level !== "ward") {
            void drill(feature.properties);
          }
        });

        const counties = await loadCollection("counties");
        showFeatures(counties.features as AdminUnit[], { level: "country" });
        setIsLoading(false);
      } catch (error) {
        setLoadError(errorMessage(error));
        setIsLoading(false);
      }
    });

    return () => {
      map.remove();
      mapRef.current = undefined;
    };
  }, [drill, loadCollection, showFeatures, onHoverChange]);

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
              results.push({
                name: String(feature.properties.shapeName),
                level: displayLevel,
                hierarchy,
                properties: feature.properties
              });
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

  // Accessible Keyboard Navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
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
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
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
    },
    [drill, onHoverChange]
  );

  // Active Race Tally for Rich Tooltip
  const activeTooltipTally = tooltip?.data?.races?.[selectedRace] || tooltip?.data?.races?.["President"];
  const cand1 = activeTooltipTally?.candidates?.[0];
  const cand2 = activeTooltipTally?.candidates?.[1];

  return (
    <div className="relative h-full min-h-0 min-w-0 overflow-hidden bg-[#EEF2F6] select-none font-sans">
      <div
        ref={container}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="absolute inset-0 z-[2] focus:outline-none"
        aria-label="Interactive Kenya administrative boundary map"
      />

      {/* Screen Reader Live Region for Accessibility */}
      <span aria-live="polite" className="sr-only absolute opacity-0 pointer-events-none">
        {announcement}
      </span>

      {/* Top Floating Controls: Breadcrumbs, Race Selector, Heatmap Modes, 2D/3D & Search */}
      <div className="absolute inset-x-4 top-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Breadcrumb Trail */}
          <nav
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white/95 px-3 py-1.5 shadow-md shadow-slate-900/5 backdrop-blur-xl"
            aria-label="Map location hierarchy"
          >
            {crumbs.map((crumb, index) => (
              <span key={crumb.level} className="flex items-center gap-1.5">
                {index > 0 && <span className="text-[10px] text-slate-300">/</span>}
                <button
                  type="button"
                  onClick={() => index < crumbs.length - 1 && void navigate(crumb.level)}
                  disabled={index === crumbs.length - 1}
                  className="text-xs font-bold tracking-tight text-slate-600 transition hover:text-slate-900 disabled:cursor-default disabled:text-slate-900"
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </nav>

          {/* Elective Position Selector */}
          <div className="relative flex items-center">
            <label htmlFor="race-selector" className="sr-only">
              Select Elective Position
            </label>
            <div className="relative flex items-center rounded-2xl border border-slate-200/90 bg-white/95 shadow-md shadow-slate-900/5 backdrop-blur-xl transition hover:border-slate-300">
              <span className="pl-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Race</span>
              <select
                id="race-selector"
                value={selectedRace}
                onChange={e => setSelectedRace(e.target.value as RaceType)}
                className="cursor-pointer appearance-none bg-transparent py-1.5 pl-2 pr-7 text-xs font-bold text-slate-900 focus:outline-none"
              >
                {ALL_RACE_TYPES.map(race => (
                  <option key={race} value={race} className="bg-white text-slate-900">
                    {race}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Map Visualization Mode Controls */}
          <div className="flex items-center rounded-2xl border border-slate-200/90 bg-white/95 p-1 shadow-md shadow-slate-900/5 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setMetricMode("margin")}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold transition ${
                metricMode === "margin" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Party Margin Blend: dynamically blends top 2 candidate party colors"
            >
              <span className="h-2 w-2 rounded-full bg-[#f2a900]" />
              <span>Party Blend</span>
            </button>

            <button
              type="button"
              onClick={() => setMetricMode("turnout")}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold transition ${
                metricMode === "turnout" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Turnout Heatmap: gradient based on turnout percentage"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Turnout</span>
            </button>

            <button
              type="button"
              onClick={() => setMetricMode("battleground")}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold transition ${
                metricMode === "battleground" ? "bg-amber-500 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Battleground Races: highlights margin <= 5%"
            >
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Battlegrounds</span>
            </button>
          </div>

          {/* 2D / 3D Perspective Toggle */}
          <div className="flex items-center rounded-2xl border border-slate-200/90 bg-white/95 p-1 shadow-md shadow-slate-900/5 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setViewMode("2D")}
              className={`rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                viewMode === "2D" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              2D
            </button>
            <button
              type="button"
              onClick={() => setViewMode("3D")}
              className={`rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                viewMode === "3D" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              3D
            </button>
          </div>
        </div>

        {/* Search Bar with Autocomplete */}
        <div className="relative pointer-events-auto w-[min(260px,calc(100vw-48px))]">
          <div className="relative flex items-center rounded-2xl border border-slate-200/90 bg-white/95 shadow-md shadow-slate-900/5 backdrop-blur-xl transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <div className="flex h-9 w-9 items-center justify-center pl-2.5 text-slate-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search Kenya..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-transparent px-2 py-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="pr-3 text-xs font-bold text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            )}
          </div>

          {searchResults.length > 0 && (
            <ul className="absolute mt-1.5 w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-xl backdrop-blur-2xl divide-y divide-slate-100">
              {searchResults.map((result, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="w-full px-3.5 py-2 text-left transition hover:bg-slate-50"
                    onClick={() => void jumpToResult(result)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{result.name}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 font-mono">
                        {result.level}
                      </span>
                    </div>
                    {result.hierarchy && <div className="text-[10px] text-slate-400">{result.hierarchy}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Map Camera Controls (Zoom In, Zoom Out, Reset Orientation) */}
      <div className="absolute right-4 bottom-4 z-20 flex flex-col gap-1 rounded-2xl border border-slate-200/90 bg-white/95 p-1 shadow-md shadow-slate-900/5 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
          className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold text-sm transition"
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
          className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold text-sm transition"
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>
        <div className="my-0.5 h-px bg-slate-200/80" />
        <button
          type="button"
          onClick={() => mapRef.current?.resetNorthPitch({ duration: 500 })}
          className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 text-xs transition"
          aria-label="Reset North & Pitch"
          title="Reset orientation to North"
        >
          🧭
        </button>
      </div>

      {/* Rich Interactive Hover Tooltip (Mini War-Room Card in Crisp Light Luxury) */}
      {tooltip && activeTooltipTally && (
        <div
          className="pointer-events-none absolute z-40 w-72 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex flex-col min-w-0">
              <span className="truncate text-sm font-extrabold text-slate-900 tracking-tight">
                {tooltip.data.shapeName}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                {tooltip.data.level} Level
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-wider text-slate-700 font-mono">
                {tooltip.data.reportingPct.toFixed(1)}% <span className="text-slate-400 font-normal">REPT</span>
              </span>
            </div>
          </div>

          {/* Race Context */}
          <div className="flex items-center justify-between py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              {selectedRace}
            </span>
            {activeTooltipTally.isNativeToLevel ? (
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-slate-700 font-mono shadow-2xs">
                Direct Seat
              </span>
            ) : (
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-slate-500 font-mono shadow-2xs">
                Parent Contribution
              </span>
            )}
          </div>

          {/* Top 2 Candidate Bars */}
          <div className="flex flex-col gap-2.5">
            {/* Candidate 1 */}
            {cand1 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full shadow-xs"
                      style={{ backgroundColor: cand1.partyColor }}
                    />
                    <span className="truncate font-bold text-slate-900">{cand1.name}</span>
                    <span className="rounded bg-slate-100 px-1 py-0.2 text-[8px] font-bold text-slate-500 font-mono">
                      {cand1.party}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-black tabular-nums text-slate-900">
                    {cand1.voteShare.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/50">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, cand1.voteShare)}%`, backgroundColor: cand1.partyColor }}
                  />
                </div>
              </div>
            )}

            {/* Candidate 2 */}
            {cand2 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full shadow-xs"
                      style={{ backgroundColor: cand2.partyColor }}
                    />
                    <span className="truncate font-semibold text-slate-800">{cand2.name}</span>
                    <span className="rounded bg-slate-100 px-1 py-0.2 text-[8px] font-bold text-slate-500 font-mono">
                      {cand2.party}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold tabular-nums text-slate-700">
                    {cand2.voteShare.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/50">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, cand2.voteShare)}%`, backgroundColor: cand2.partyColor }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Metrics Row */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] font-mono text-slate-500">
            <span>
              Turnout: <strong className="text-slate-900">{activeTooltipTally.turnoutPct.toFixed(1)}%</strong>
            </span>
            <span>
              Margin: <strong className="text-slate-900">+{activeTooltipTally.margin.toFixed(1)}%</strong>
            </span>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-emerald-600" />
            <span className="rounded-2xl border border-slate-200/80 bg-white/95 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 shadow-md font-mono">
              Synthesizing Electoral Boundaries...
            </span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {loadError && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-white/95 p-6 text-center">
          <div>
            <p className="text-sm font-bold text-slate-900">Map unavailable</p>
            <p className="mt-2 text-xs text-slate-500">{loadError}</p>
            <button
              type="button"
              onClick={() => void navigate("country")}
              className="mt-6 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-200 shadow-xs"
            >
              Retry map
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
