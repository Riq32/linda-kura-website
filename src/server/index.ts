import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { mockResults } from "../lib/results";
<<<<<<< HEAD
<<<<<<< HEAD
import type { StationResult } from "../shared/types";
const app = Fastify({ logger: true }); const io = new Server(app.server, { cors: { origin: true } });
let stations: GeoJSON.FeatureCollection | undefined; const stationResults: StationResult[] = [];
async function stationData() { if (!stations) stations = JSON.parse(await readFile(path.resolve(process.cwd(), "data/polling_stations.geojson"), "utf8")); return stations; }
async function start() {
 await app.register(cors, { origin: true }); app.get("/health", async () => ({ ok: true })); app.get("/api/results/summary", async () => mockResults);
 app.get("/api/polling-stations", async (request) => { const wardShapeID = (request.query as { wardShapeID?: string }).wardShapeID; if (!wardShapeID) return { type: "FeatureCollection", features: [] }; const data = await stationData(); return { type: "FeatureCollection", features: data!.features.filter((feature: any) => feature.properties.wardShapeID === wardShapeID) }; });
 app.get("/api/results", async () => stationResults);
 app.post("/api/results", async (request, reply) => { const rows = Array.isArray(request.body) ? request.body : [request.body]; for (const row of rows as StationResult[]) { if (!row?.polling_station?.name || !row.candidate_name || typeof row.votes !== "number") return reply.code(400).send({ error: "polling_station.name, candidate_name and votes are required" }); stationResults.push(row); } io.emit("results:stations", stationResults); return reply.code(201).send({ accepted: rows.length }); });
 io.on("connection", socket => socket.emit("results:stations", stationResults)); await app.listen({ port: Number(process.env.API_PORT ?? 3001), host: "0.0.0.0" });
} void start();
=======
=======
>>>>>>> ephra
import { generateGranularRegionData } from "../lib/election-engine";
import type { DrillLevel } from "../shared/types";

const app = Fastify({ logger: true });
const io = new Server(app.server, { cors: { origin: true } });

const MOCK_USERS: Record<string, any> = {
  "LK-36QW": {
    id: "1",
    username: "admin",
    name: "Mombasa Field Agent",
    access_code: "LK-36QW",
    county: "MOMBASA County",
    constituency: "CHANGAMWE Constituency",
    ward: "PORT REITZ",
    polling_station: "Hope Internet"
  },
  "LK-7KQ2": {
    id: "2",
    username: "agent_nairobi",
    name: "Nairobi Field Agent",
    access_code: "LK-7KQ2",
    county: "NAIROBI County",
    constituency: "STAREHE Constituency",
    ward: "CENTRAL",
    polling_station: "Nairobi Primary School Stn 1"
  }
};

const CANDIDATES = [
  {
    id: "cand-1-uda",
    full_name: "William Samoei Ruto",
    first_name: "William",
    last_name: "Ruto",
    party_name: "UDA",
    party_color: "#f2a900",
    position: "presidential",
    position_name: "President",
    is_independent: false,
    is_active: true
  },
  {
    id: "cand-2-odm",
    full_name: "Raila Amolo Odinga",
    first_name: "Raila",
    last_name: "Odinga",
    party_name: "ODM",
    party_color: "#f26522",
    position: "presidential",
    position_name: "President",
    is_independent: false,
    is_active: true
  },
  {
    id: "cand-3-jubilee",
    full_name: "Uhuru Muigai Kenyatta",
    first_name: "Uhuru",
    last_name: "Kenyatta",
    party_name: "Jubilee",
    party_color: "#d12421",
    position: "presidential",
    position_name: "President",
    is_independent: false,
    is_active: true
  },
  {
    id: "cand-4-wiper",
    full_name: "Kalonzo Musyoka",
    first_name: "Kalonzo",
    last_name: "Musyoka",
    party_name: "Wiper",
    party_color: "#00aeea",
    position: "presidential",
    position_name: "President",
    is_independent: false,
    is_active: true
  }
];

async function start() {
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true }));
  app.get("/api/results/summary", async () => mockResults);

  // Authentication endpoint matching Lindakura Elections API
  app.post("/api/auth/", async (req: any, reply) => {
    const { code } = (req.body as any) || {};
    const agentCode = (code || "").toUpperCase().trim();

    const user = MOCK_USERS[agentCode] || {
      id: String(Math.floor(Math.random() * 1000) + 1),
      username: `agent_${agentCode.replace(/[^A-Z0-9]/g, "").toLowerCase()}`,
      name: "",
      access_code: agentCode || "LK-36QW",
      county: "MOMBASA County",
      constituency: "CHANGAMWE Constituency",
      ward: "PORT REITZ",
      polling_station: "Hope Internet"
    };

    return reply.send({
      access: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzg3NzI4NTY2LCJpYXQiOjE3ODc3MjMxNjYsImp0aSI6ImMwZWMyMzJiNzIzMjRiNmI4YzY3MmM0MDExMjcyNTE3IiwidXNlcl9pZCI6IjEifQ.VtHJ_uoSy3mvjsbsrKfHENyCh6s6IUyALirGAlgMx4Q",
      refresh: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NzgwOTU2NiwiaWF0IjoxNzg3NzIzMTY2LCJqdGkiOiI1ZGJlZGMzZTljNWY0NmFkYWY4ODFjMTkwYWYzNDJiOSIsInVzZXJfaWQiOiIxIn0.sV3dT5irZPHCT_4A5o7iZJN27NNPJPVSBFm7uNSwMJk",
      user
    });
  });

  // Candidates list
  app.get("/api/elections/candidates/", async () => CANDIDATES);

  // Results submission
  app.post("/api/elections/results/submit/", async (req: any, reply) => {
    const data = req.body;
    // Broadcast live update over Socket.io
    io.emit("results:stream_update", {
      submission: data,
      timestamp: new Date().toISOString()
    });
    return reply.status(201).send({
      status: "SUBMITTED",
      received_at: new Date().toISOString(),
      ...data
    });
  });

  // ----------------------------------------------------
  // Granular Engine REST Endpoints (v1)
  // ----------------------------------------------------

  // GET /api/v1/units/:shapeID - Accepts query parameters for level, name, county, and constituency
  app.get("/api/v1/units/:shapeID", async (req: any, reply) => {
    const { shapeID } = req.params;
    const { level = "county", name, county, constituency } = (req.query as any) || {};
    const regionName = name || `Unit ${shapeID}`;

    const data = generateGranularRegionData(
      shapeID,
      regionName,
      level as DrillLevel,
      county,
      constituency
    );

    return reply.send(data);
  });

  // GET /api/v1/wards/:wardShapeID/stations - Returns pollingStations array for a specific ward
  app.get("/api/v1/wards/:wardShapeID/stations", async (req: any, reply) => {
    const { wardShapeID } = req.params;
    const { name, county, constituency } = (req.query as any) || {};
    const wardName = name || `Ward ${wardShapeID}`;

    const data = generateGranularRegionData(
      wardShapeID,
      wardName,
      "ward",
      county,
      constituency
    );

    return reply.send(data.pollingStations || []);
  });

  // Telemetry Analysis Endpoints
  app.get("/analysis/presidential/", async () => {
    return generateGranularRegionData("KENYA", "Kenya", "country");
  });

  app.get("/analysis/county/:id/", async (req: any) => {
    return generateGranularRegionData(req.params.id, `County ${req.params.id}`, "county");
  });

  app.get("/analysis/constituency/:id/", async (req: any) => {
    return generateGranularRegionData(req.params.id, `Constituency ${req.params.id}`, "constituency");
  });

  app.get("/analysis/ward/:id/", async (req: any) => {
    return generateGranularRegionData(req.params.id, `Ward ${req.params.id}`, "ward");
  });

  io.on("connection", socket => {
    socket.emit("results:summary", mockResults);
  });

  await app.listen({ port: Number(process.env.API_PORT ?? 3001), host: "0.0.0.0" });
}

void start();
>>>>>>> ephra
