import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { mockResults } from "../lib/results";
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