export type DrillLevel = "country" | "county" | "constituency" | "ward";

export interface AdminUnitProperties {
  shapeName: string;
  shapeID: string;
  county_shapeName?: string;
  county_shapeID?: string;
  constituency_shapeName?: string;
  constituency_shapeID?: string;
}

export interface AdminUnit {
  type: "Feature";
  properties: AdminUnitProperties;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface Candidate { id: string; name: string; party: string; votes: number; color: "green" | "gold" | "red"; }
export type ResultProvenance = "Mock data" | "Verified crowdsourced" | "Unverified";

export interface ResultSummary {
  race: string;
  reportingPercent: number;
  turnoutPercent: number;
  provenance: ResultProvenance;
  candidates: Candidate[];
}

export interface MapLocation {
  level: DrillLevel;
  county?: AdminUnit;
  constituency?: AdminUnit;
  ward?: AdminUnit;
}

export interface PartyResult {
  party: string;
  candidate: string;
  percentage: number;
  votes: number;
  color: string;
}

export interface RegionElectionData {
  name: string;
  stationsReportingPct: number;
  turnoutPct: number;
  totalVotesCast: number;
  margin: number;
  winningParty: string;
  runnerUp: string;
  blendedColor?: string;
  partyBreakdown: PartyResult[];
}
