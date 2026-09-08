import type { DrillLevel, ResultSummary, RegionElectionData } from "@/shared/types";
import { generateGranularRegionData, blendPartyColors } from "./election-engine";

export { blendPartyColors };

/** Demonstration-only figures used until a validated tally source is connected. */
export const mockResults: ResultSummary = {
  race: "President",
  reportingPercent: 34,
  turnoutPercent: 61.2,
  provenance: "Mock data",
  candidates: [
    { id: "amina", name: "Amina Njoroge", party: "UPM", votes: 2418903, color: "green" },
    { id: "david", name: "David K. Otieno", party: "Umoja", votes: 1987515, color: "gold" },
    { id: "wanjiku", name: "Wanjiku Mwangi", party: "Huru", votes: 642790, color: "red" }
  ]
};

const mockResultsByLevel: Record<DrillLevel, ResultSummary> = {
  country: mockResults,
  county: {
    race: "Governor",
    reportingPercent: 47,
    turnoutPercent: 58.7,
    provenance: "Mock data",
    candidates: [
      { id: "governor-njeri", name: "Grace Njeri", party: "UPM", votes: 184230, color: "green" },
      { id: "governor-kiptoo", name: "Peter Kiptoo", party: "Umoja", votes: 161940, color: "gold" },
      { id: "governor-hassan", name: "Salim Hassan", party: "Huru", votes: 63310, color: "red" }
    ]
  },
  constituency: {
    race: "MP",
    reportingPercent: 53,
    turnoutPercent: 56.4,
    provenance: "Mock data",
    candidates: [
      { id: "mp-wanjala", name: "Brian Wanjala", party: "UPM", votes: 35680, color: "green" },
      { id: "mp-cheruiyot", name: "Faith Cheruiyot", party: "Umoja", votes: 33120, color: "gold" },
      { id: "mp-odhiambo", name: "Kevin Odhiambo", party: "Huru", votes: 12470, color: "red" }
    ]
  },
  ward: {
    race: "MCA",
    reportingPercent: 61,
    turnoutPercent: 54.9,
    provenance: "Mock data",
    candidates: [
      { id: "mca-wambui", name: "Mary Wambui", party: "UPM", votes: 8940, color: "green" },
      { id: "mca-barasa", name: "John Barasa", party: "Umoja", votes: 8015, color: "gold" },
      { id: "mca-nyongesa", name: "Lilian Nyongesa", party: "Huru", votes: 3140, color: "red" }
    ]
  }
};

export function getMockResults(level: DrillLevel) {
  return mockResultsByLevel[level];
}

export const PARTIES = [
  { name: "UDA", candidate: "William Ruto", color: "#f2a900" },
  { name: "ODM", candidate: "Raila Odinga", color: "#f26522" },
  { name: "Jubilee", candidate: "Uhuru Kenyatta", color: "#d12421" },
  { name: "Wiper", candidate: "Kalonzo Musyoka", color: "#00aeea" }
];

export function generateMockElectionData(featureId: string, level: string, name: string): RegionElectionData {
  return generateGranularRegionData(
    featureId,
    name,
    (level as DrillLevel) || "county"
  );
}
