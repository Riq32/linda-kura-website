import type { DrillLevel, ResultSummary } from "@/shared/types";

/** Demonstration-only figures used until a validated tally source is connected. */
export const mockResults: ResultSummary = {
  race: "President", reportingPercent: 34, turnoutPercent: 61.2, provenance: "Mock data",
  candidates: [
    { id: "amina", name: "Amina Njoroge", party: "UPM", votes: 2418903, color: "green" },
    { id: "david", name: "David K. Otieno", party: "Umoja", votes: 1987515, color: "gold" },
    { id: "wanjiku", name: "Wanjiku Mwangi", party: "Huru", votes: 642790, color: "red" }
  ]
};

const mockResultsByLevel: Partial<Record<DrillLevel, ResultSummary>> = {
  country: mockResults,
  county: {
    race: "Governor", reportingPercent: 47, turnoutPercent: 58.7, provenance: "Mock data",
    candidates: [
      { id: "governor-njeri", name: "Grace Njeri", party: "UPM", votes: 184230, color: "green" },
      { id: "governor-kiptoo", name: "Peter Kiptoo", party: "Umoja", votes: 161940, color: "gold" },
      { id: "governor-hassan", name: "Salim Hassan", party: "Huru", votes: 63310, color: "red" }
    ]
  },
  constituency: {
    race: "MP", reportingPercent: 53, turnoutPercent: 56.4, provenance: "Mock data",
    candidates: [
      { id: "mp-wanjala", name: "Brian Wanjala", party: "UPM", votes: 35680, color: "green" },
      { id: "mp-cheruiyot", name: "Faith Cheruiyot", party: "Umoja", votes: 33120, color: "gold" },
      { id: "mp-odhiambo", name: "Kevin Odhiambo", party: "Huru", votes: 12470, color: "red" }
    ]
  },
  ward: {
    race: "MCA", reportingPercent: 61, turnoutPercent: 54.9, provenance: "Mock data",
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
  { name: 'UDA', candidate: 'William Ruto', color: '#f2a900' },
  { name: 'ODM', candidate: 'Raila Odinga', color: '#f26522' },
  { name: 'Jubilee', candidate: 'Uhuru Kenyatta', color: '#d12421' },
  { name: 'Wiper', candidate: 'Kalonzo Musyoka', color: '#00aeea' }
];

export function blendPartyColors(winnerColor: string, runnerUpColor: string, margin: number) {
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

import type { RegionElectionData } from "@/shared/types";

export function generateMockElectionData(featureId: string, level: string, name: string): RegionElectionData {
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
  
  const totalVotesCast = Math.floor(10000 + random() * 500000);
  const stationsReportingPct = 10 + random() * 90;
  const turnoutPct = 40 + random() * 45;

  const winnerColor = winner.color;
  const runnerUpColor = runnerUp.color;
  const blendedColor = blendPartyColors(winnerColor, runnerUpColor, margin);

  return {
    name,
    winningParty: winner.name,
    runnerUp: runnerUp.name,
    margin,
    stationsReportingPct,
    turnoutPct,
    totalVotesCast,
    blendedColor,
    partyBreakdown: [
      { party: winner.name, candidate: winner.candidate, percentage: winnerPct, votes: Math.floor(totalVotesCast * winnerPct / 100), color: winner.color },
      { party: runnerUp.name, candidate: runnerUp.candidate, percentage: runnerUpPct, votes: Math.floor(totalVotesCast * runnerUpPct / 100), color: runnerUp.color },
      { party: 'Others', candidate: 'Other Candidates', percentage: othersPct, votes: Math.floor(totalVotesCast * othersPct / 100), color: '#888888' }
    ]
  };
}
