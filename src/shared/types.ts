export type DrillLevel = "country" | "county" | "constituency" | "ward";

export type RaceType =
  | "President"
  | "Governor"
  | "Senator"
  | "Woman Representative"
  | "Member of Parliament"
  | "Member of County Assembly";

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

export interface CandidateResult {
  id: string;
  name: string;
  party: string;
  partyColor: string;
  votes: number;
  voteShare: number; // Percentage e.g. 52.4
}

export interface PollingStation {
  id: string;
  name: string;
  code: string;
  registeredVoters: number;
  votesCast: number;
  turnoutPct: number;
  status: "reporting" | "pending" | "completed" | string;
  results: CandidateResult[];
}

export interface RaceTally {
  race: RaceType;
  level: DrillLevel;
  isNativeToLevel: boolean;
  registeredVoters: number;
  totalVotesCast: number;
  validVotes: number;
  rejectedVotes: number;
  turnoutPct: number;
  margin: number;
  winner: CandidateResult;
  runnerUp: CandidateResult;
  candidates: CandidateResult[];
}

export interface DetailedRegionData {
  shapeID: string;
  shapeName: string;
  level: DrillLevel;
  countyName?: string;
  constituencyName?: string;
  registeredVoters: number;
  totalPollingStations: number;
  reportingPollingStations: number;
  reportingPct: number;
  totalVotesCast: number;
  turnoutPct: number;
  blendedColor: string;
  races: Record<RaceType, RaceTally>;
  pollingStations?: PollingStation[];

  // Compatibility fields for legacy views / ResultSummary panels
  name: string;
  margin: number;
  stationsReportingPct: number;
  winningParty: string;
  runnerUp: string;
  partyBreakdown: PartyResult[];
  hasResults?: boolean;
}

export type RegionElectionData = DetailedRegionData;

export interface PartyResult {
  party: string;
  candidate: string;
  percentage: number;
  votes: number;
  color: string;
}

/** A reported result recorded at a polling station. */
export interface StationResult {
  polling_station: { name: string; code?: string | null };
  wardShapeID?: string;
  wardName?: string;
  constituencyName?: string;
  countyName?: string;
  race: string;
  candidate_name: string;
  party?: string | null;
  votes: number;
  registered_voters?: number;
  reported?: boolean;
}

export interface Candidate {
  id: string;
  name: string;
  party: string;
  votes: number;
  color: "green" | "gold" | "red" | string;
}

export type ResultProvenance = "Mock data" | "Verified crowdsourced" | "Unverified" | "Official IEBC Feed";

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

// ----------------------------------------------------
// Lindakura Elections API Definitions
// ----------------------------------------------------

export interface AgentUser {
  id: string;
  username: string;
  name: string;
  access_code: string;
  county: string;
  constituency: string;
  ward: string;
  polling_station: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: AgentUser;
}

export interface ApiCandidate {
  id: string;
  full_name: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  other_names?: string | null;
  photo?: string | null;
  party?: string | null;
  party_name: string;
  party_color: string;
  position: string;
  position_name: string;
  county?: string | null;
  constituency?: string | null;
  ward?: string | null;
  is_independent: boolean;
  is_active: boolean;
}

export interface ApiCandidateVote {
  candidate: string;
  votes: number;
}

export interface PollingStationResultBulk {
  results: Array<ApiCandidateVote | CandidateResult>;
}

export interface ApiPollingCentre {
  id: string;
  name: string;
  registered_voters: number;
  polling_stations_count: number;
  source_url?: string | null;
}

export interface ApiWard {
  id: string;
  code: number;
  name: string;
  registered_voters: number;
  polling_stations_count: number;
  polling_centres?: ApiPollingCentre[];
}

export interface ApiConstituency {
  id: string;
  code: number;
  name: string;
  registered_voters: number;
  polling_stations_count: number;
  wards?: ApiWard[];
}

export interface ApiCounty {
  id: string;
  code: number;
  name: string;
  constituencies?: ApiConstituency[];
}
