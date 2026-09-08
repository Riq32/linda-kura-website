import type {
  DrillLevel,
  RaceType,
  CandidateResult,
  PollingStation,
  RaceTally,
  DetailedRegionData,
  PartyResult
} from "@/shared/types";

/**
 * 32-bit integer hash and Mulberry32 PRNG.
 * Ensures identical results for any (shapeID + level) combination across reloads.
 */
export function createPRNG(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export interface CountyArchetype {
  id: "urban" | "pastoralist" | "agrarian";
  name: string;
  votersPerWard: { min: number; max: number };
  stationsPerWard: { min: number; max: number };
  baseTurnout: number; // percentage, e.g. 62
  turnoutVariance: number; // +/- percentage
  rejectedVoteRate: number; // fraction, e.g. 0.011 (1.1%)
  primaryLeanParty: "UDA" | "ODM" | "Jubilee" | "Wiper";
  secondaryLeanParty: "UDA" | "ODM" | "Jubilee" | "Wiper";
}

export const URBAN_METROPOLIS_ARCHETYPE: CountyArchetype = {
  id: "urban",
  name: "Urban Metropolis",
  votersPerWard: { min: 22000, max: 36000 },
  stationsPerWard: { min: 35, max: 55 },
  baseTurnout: 62.5,
  turnoutVariance: 5.5,
  rejectedVoteRate: 0.009,
  primaryLeanParty: "ODM",
  secondaryLeanParty: "UDA"
};

export const PASTORALIST_ARID_ARCHETYPE: CountyArchetype = {
  id: "pastoralist",
  name: "Pastoralist / Arid",
  votersPerWard: { min: 4000, max: 9000 },
  stationsPerWard: { min: 10, max: 20 },
  baseTurnout: 79.0,
  turnoutVariance: 6.0,
  rejectedVoteRate: 0.017,
  primaryLeanParty: "UDA",
  secondaryLeanParty: "ODM"
};

export const AGRARIAN_ARCHETYPE: CountyArchetype = {
  id: "agrarian",
  name: "Rural / Agrarian",
  votersPerWard: { min: 10000, max: 18000 },
  stationsPerWard: { min: 18, max: 32 },
  baseTurnout: 69.5,
  turnoutVariance: 5.0,
  rejectedVoteRate: 0.012,
  primaryLeanParty: "UDA",
  secondaryLeanParty: "ODM"
};

/**
 * Returns archetype based on county name.
 * Identifies Urban Metropolis (Nairobi/Mombasa/Nakuru/Kisumu/Kiambu),
 * Pastoralist/Arid (Samburu/Turkana/Marsabit/Mandera/Wajir/Garissa/Isiolo),
 * and defaults to Rural/Agrarian profile.
 */
export function getCountyArchetype(countyName?: string): CountyArchetype {
  if (!countyName) return AGRARIAN_ARCHETYPE;
  const name = countyName.toLowerCase().replace(/county/g, "").trim();

  const urbanCounties = ["nairobi", "mombasa", "nakuru", "kisumu", "kiambu"];
  const pastoralistCounties = [
    "samburu",
    "turkana",
    "marsabit",
    "mandera",
    "wajir",
    "garissa",
    "isiolo",
    "tana river",
    "west pokot",
    "wajir"
  ];

  if (urbanCounties.some(c => name.includes(c))) {
    return URBAN_METROPOLIS_ARCHETYPE;
  }
  if (pastoralistCounties.some(c => name.includes(c))) {
    return PASTORALIST_ARID_ARCHETYPE;
  }
  return AGRARIAN_ARCHETYPE;
}

export const ALL_RACE_TYPES: RaceType[] = [
  "President",
  "Governor",
  "Senator",
  "Woman Representative",
  "Member of Parliament",
  "Member of County Assembly"
];

export const MAJOR_PARTIES = [
  { name: "UDA", color: "#f2a900" },
  { name: "ODM", color: "#f26522" },
  { name: "Jubilee", color: "#d12421" },
  { name: "Wiper", color: "#00aeea" },
  { name: "Roots Party", color: "#2e7d32" },
  { name: "Agano", color: "#8e24aa" },
  { name: "Independent", color: "#78909c" }
];

const MOCK_FIRST_NAMES_MALE = [
  "Peter", "Brian", "Kevin", "John", "Salim", "David",
  "Samuel", "Mwangi", "Juma", "Emmanuel", "Hassan",
  "Kiprono", "Barasa", "Paul", "Abdi", "Daniel", "Moses"
];

const MOCK_FIRST_NAMES_FEMALE = [
  "Grace", "Faith", "Mary", "Lilian", "Amina", "Wanjiku",
  "Mercy", "Joyce", "Beatrice", "Fatuma", "Sharon", "Halima",
  "Wangari", "Chebet", "Zawadi"
];

const MOCK_LAST_NAMES = [
  "Njoroge", "Otieno", "Mwangi", "Kiptoo", "Hassan", "Wanjala",
  "Cheruiyot", "Odhiambo", "Barasa", "Nyongesa", "Kamau", "Ochieng",
  "Kipkemboi", "Maina", "Kariuki", "Mutua", "Musyoka", "Chebet",
  "Korir", "Ali", "Farah", "Wekesa", "Wafula", "Ndung'u", "Onyango"
];

function pickRandom<T>(array: T[], rng: () => number): T {
  return array[Math.floor(rng() * array.length)];
}

/**
 * Blend two party colors based on margin of victory
 */
export function blendPartyColors(winnerColor: string, runnerUpColor: string, margin: number): string {
  const parseHex = (hex: string) => {
    const clean = hex.replace("#", "");
    return [
      parseInt(clean.slice(0, 2), 16) || 0,
      parseInt(clean.slice(2, 4), 16) || 0,
      parseInt(clean.slice(4, 6), 16) || 0
    ];
  };

  const c1 = parseHex(winnerColor);
  const c2 = parseHex(runnerUpColor);

  // As margin increases, winner ratio approaches 1.0. At 0 margin, it's 50/50.
  const winnerRatio = Math.min(1, Math.max(0.5, 0.5 + margin / 70));
  const runnerUpRatio = 1 - winnerRatio;

  const r = Math.round(c1[0] * winnerRatio + c2[0] * runnerUpRatio);
  const g = Math.round(c1[1] * winnerRatio + c2[1] * runnerUpRatio);
  const b = Math.round(c1[2] * winnerRatio + c2[2] * runnerUpRatio);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Helper to determine if a race is native to the selected administrative drill level
 */
export function isNativeToLevel(race: RaceType, level: DrillLevel): boolean {
  switch (race) {
    case "President":
      return level === "country";
    case "Governor":
    case "Senator":
    case "Woman Representative":
      return level === "county";
    case "Member of Parliament":
      return level === "constituency";
    case "Member of County Assembly":
      return level === "ward";
    default:
      return false;
  }
}

/**
 * Generates realistic candidates and tallies for a single race in a region
 */
export function generateRaceTally(
  race: RaceType,
  level: DrillLevel,
  registeredVoters: number,
  archetype: CountyArchetype,
  rng: () => number,
  regionName: string
): RaceTally {
  // Realistic turnout with archetype variance
  const turnoutJitter = (rng() * 2 - 1) * archetype.turnoutVariance;
  const turnoutPct = Number(Math.min(94, Math.max(48, archetype.baseTurnout + turnoutJitter)).toFixed(1));
  const totalVotesCast = Math.round(registeredVoters * (turnoutPct / 100));

  // Rejected / spoilt votes
  const rejectedRate = archetype.rejectedVoteRate * (0.8 + rng() * 0.4);
  const rejectedVotes = Math.round(totalVotesCast * rejectedRate);
  const validVotes = Math.max(0, totalVotesCast - rejectedVotes);

  // Setup candidates
  interface RawCandidate {
    id: string;
    name: string;
    party: string;
    partyColor: string;
  }

  let mockCandidates: RawCandidate[] = [];

  if (race === "President") {
    mockCandidates = [
      { id: "pres-ruto", name: "William Samoei Ruto", party: "UDA", partyColor: "#f2a900" },
      { id: "pres-odinga", name: "Raila Amolo Odinga", party: "ODM", partyColor: "#f26522" },
      { id: "pres-wajackoyah", name: "George Wajackoyah", party: "Roots Party", partyColor: "#2e7d32" },
      { id: "pres-mwaure", name: "David Mwaure Waihiga", party: "Agano", partyColor: "#8e24aa" }
    ];
  } else {
    // Generate regional candidates
    const parties = [
      MAJOR_PARTIES[0], // UDA
      MAJOR_PARTIES[1], // ODM
      MAJOR_PARTIES[2], // Jubilee
      MAJOR_PARTIES[3], // Wiper
      MAJOR_PARTIES[6]  // Independent
    ];

    const isFemalePosition = race === "Woman Representative";
    const firstNamesPool = isFemalePosition
      ? MOCK_FIRST_NAMES_FEMALE
      : [...MOCK_FIRST_NAMES_MALE, ...MOCK_FIRST_NAMES_FEMALE.slice(0, 4)];

    const candidateCount = 3 + Math.floor(rng() * 2); // 3 or 4 candidates
    const usedParties = new Set<string>();

    for (let i = 0; i < candidateCount; i++) {
      let party = parties[i % parties.length];
      if (usedParties.has(party.name)) {
        party = parties[(i + 2) % parties.length];
      }
      usedParties.add(party.name);

      const fName = pickRandom(firstNamesPool, rng);
      const lName = pickRandom(MOCK_LAST_NAMES, rng);
      mockCandidates.push({
        id: `${race.toLowerCase().replace(/\s+/g, "-")}-${i + 1}-${party.name.toLowerCase()}`,
        name: `${fName} ${lName}`,
        party: party.name,
        partyColor: party.color
      });
    }
  }

  // Allocate votes:
  // Decide which candidate leads in this specific region.
  // In urban or pastoralist areas, archetype primaryLean gets an initial boost.
  const weights = mockCandidates.map((c, idx) => {
    let weight = 1.0;
    if (c.party === archetype.primaryLeanParty) {
      weight += 1.2 + rng() * 1.5;
    } else if (c.party === archetype.secondaryLeanParty) {
      weight += 0.8 + rng() * 1.0;
    } else if (idx < 2) {
      weight += 0.5 + rng() * 0.8;
    } else {
      weight += rng() * 0.15; // Minor candidates get small slice
    }
    return Math.max(0.05, weight);
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Distribute valid votes
  let remainingVotes = validVotes;
  const candidateResults: CandidateResult[] = mockCandidates.map((cand, idx) => {
    const isLast = idx === mockCandidates.length - 1;
    let votes = 0;
    if (isLast) {
      votes = Math.max(0, remainingVotes);
    } else {
      const share = weights[idx] / totalWeight;
      votes = Math.min(remainingVotes, Math.max(0, Math.round(validVotes * share)));
      remainingVotes -= votes;
    }
    const voteShare = validVotes > 0 ? Number(((votes / validVotes) * 100).toFixed(1)) : 0;

    return {
      id: cand.id,
      name: cand.name,
      party: cand.party,
      partyColor: cand.partyColor,
      votes,
      voteShare
    };
  });

  // Sort candidates by votes descending
  candidateResults.sort((a, b) => b.votes - a.votes);

  // Recalculate exact voteShare percentages
  candidateResults.forEach((c) => {
    c.voteShare = validVotes > 0 ? Number(((c.votes / validVotes) * 100).toFixed(1)) : 0;
  });

  const winner = candidateResults[0];
  const runnerUp = candidateResults[1] || candidateResults[0];
  const margin = Number(Math.max(0, winner.voteShare - runnerUp.voteShare).toFixed(1));

  return {
    race,
    level,
    isNativeToLevel: isNativeToLevel(race, level),
    registeredVoters,
    totalVotesCast,
    validVotes,
    rejectedVotes,
    turnoutPct,
    margin,
    winner,
    runnerUp,
    candidates: candidateResults
  };
}

/**
 * Main export: Generates granular demographic and polling data strictly keyed to shapeID & level.
 */
export function generateGranularRegionData(
  shapeID: string,
  shapeName: string,
  level: DrillLevel,
  countyName?: string,
  constituencyName?: string
): DetailedRegionData {
  const seed = `${shapeID}:${level}`;
  const rng = createPRNG(seed);

  // Resolve county archetype
  const effectiveCountyName = countyName || (level === "county" ? shapeName : "Kenya");
  const archetype = getCountyArchetype(effectiveCountyName);

  // Scale registered voters based on drill level
  let registeredVoters = 0;
  let totalPollingStations = 0;

  switch (level) {
    case "country":
      registeredVoters = 22120458; // Official Kenya voter registry scale
      totalPollingStations = 46229;
      break;

    case "county":
      if (archetype.id === "urban") {
        registeredVoters = Math.round(1600000 + rng() * 850000);
      } else if (archetype.id === "pastoralist") {
        registeredVoters = Math.round(90000 + rng() * 180000);
      } else {
        registeredVoters = Math.round(350000 + rng() * 320000);
      }
      totalPollingStations = Math.max(120, Math.round(registeredVoters / (460 + rng() * 80)));
      break;

    case "constituency": {
      const wardsInConstituency = 4 + Math.floor(rng() * 3);
      const wardVoters = archetype.votersPerWard.min + rng() * (archetype.votersPerWard.max - archetype.votersPerWard.min);
      registeredVoters = Math.round(wardsInConstituency * wardVoters);
      totalPollingStations = Math.max(30, Math.round(registeredVoters / (480 + rng() * 70)));
      break;
    }

    case "ward":
    default: {
      registeredVoters = Math.round(
        archetype.votersPerWard.min + rng() * (archetype.votersPerWard.max - archetype.votersPerWard.min)
      );
      totalPollingStations = Math.max(
        6,
        Math.round(archetype.stationsPerWard.min + rng() * (archetype.stationsPerWard.max - archetype.stationsPerWard.min))
      );
      break;
    }
  }

  // Realistic reporting status
  const reportingPct = Number(Math.min(100, Math.max(68, 88 + (rng() * 2 - 1) * 11)).toFixed(1));
  const reportingPollingStations = Math.round(totalPollingStations * (reportingPct / 100));

  // Generate tallies for all 6 Kenyan elective races
  const races = {} as Record<RaceType, RaceTally>;
  for (const race of ALL_RACE_TYPES) {
    races[race] = generateRaceTally(
      race,
      level,
      registeredVoters,
      archetype,
      rng,
      shapeName
    );
  }

  // Presidential race sets the blended color and default telemetry
  const presTally = races["President"];
  const blendedColor = blendPartyColors(presTally.winner.partyColor, presTally.runnerUp.partyColor, presTally.margin);

  // If level is "ward", generate mock PollingStation items
  let pollingStations: PollingStation[] | undefined = undefined;
  if (level === "ward") {
    pollingStations = [];
    const stationVenues = [
      "Primary School",
      "Secondary School",
      "Community Hall",
      "Social Hall",
      "Polytechnic",
      "Dispensary Grounds",
      "Day Nursery"
    ];

    let remainingVoters = registeredVoters;
    for (let i = 0; i < totalPollingStations; i++) {
      const isLast = i === totalPollingStations - 1;
      const stationVoters = isLast
        ? Math.max(150, remainingVoters)
        : Math.round((registeredVoters / totalPollingStations) * (0.88 + rng() * 0.24));
      remainingVoters -= stationVoters;

      const stationTurnout = Number(Math.min(96, Math.max(45, presTally.turnoutPct + (rng() * 10 - 5))).toFixed(1));
      const stationVotesCast = Math.round(stationVoters * (stationTurnout / 100));
      const isReporting = i < reportingPollingStations;
      const status = isReporting ? (i % 7 === 0 ? "reporting" : "completed") : "pending";

      const venue = stationVenues[i % stationVenues.length];
      const streamNum = Math.floor(i / stationVenues.length) + 1;
      const stationName = `${shapeName} ${venue} - Stream ${streamNum}`;
      const code = String(10000 + Math.floor(rng() * 89999));

      // Station-level candidate breakdown for presidential race
      const stationResults: CandidateResult[] = presTally.candidates.map(cand => {
        const jitter = (rng() * 0.1 - 0.05);
        const stShare = Math.max(0, cand.voteShare / 100 + jitter);
        const candVotes = Math.round(stationVotesCast * stShare);
        return {
          id: cand.id,
          name: cand.name,
          party: cand.party,
          partyColor: cand.partyColor,
          votes: candVotes,
          voteShare: cand.voteShare
        };
      });

      pollingStations.push({
        id: `${shapeID}-PS-${String(i + 1).padStart(2, "0")}`,
        name: stationName,
        code,
        registeredVoters: stationVoters,
        votesCast: isReporting ? stationVotesCast : 0,
        turnoutPct: isReporting ? stationTurnout : 0,
        status,
        results: isReporting ? stationResults : []
      });
    }
  }

  // Compatibility party breakdown
  const partyBreakdown: PartyResult[] = presTally.candidates.map(c => ({
    party: c.party,
    candidate: c.name,
    percentage: c.voteShare,
    votes: c.votes,
    color: c.partyColor
  }));

  return {
    shapeID,
    shapeName,
    level,
    countyName,
    constituencyName,
    registeredVoters,
    totalPollingStations,
    reportingPollingStations,
    reportingPct,
    totalVotesCast: presTally.totalVotesCast,
    turnoutPct: presTally.turnoutPct,
    blendedColor,
    races,
    pollingStations,

    // Compatibility fields
    name: shapeName,
    margin: presTally.margin,
    stationsReportingPct: reportingPct,
    winningParty: presTally.winner.party,
    runnerUp: presTally.runnerUp.party,
    partyBreakdown
  };
}
